"use client"
import apiclient from "@/utils/apiClient"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import html2canvas from "html2canvas"
import { 
  Button, 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle, 
  RadioGroup, 
  RadioGroupItem, 
  Label
} from "@/components/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Clock, HelpCircle, Trophy } from "lucide-react"
import Certificate from "@/components/Certificate"
import { learningPathApi } from '@/utils/learningPathApi'
import { useRouter } from "next/navigation"

interface AssessmentData {
  id: number
  title: string
  description: string
  passing_score: number
  time_limit: number
  questions: Array<{
    id: number
    text: string
    options: Array<{
      id: number
      text: string
    }>
  }>
}

interface SubmissionResponse {
  attempt_id: number
  score: number
  passing_score: number
  passed: boolean
}

interface UserData {
  username: string
  first_name: string
  last_name: string
}

export default function AssessmentPage() {
  const searchParams = useSearchParams()
  const [assessment, setAssessment] = useState<AssessmentData | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeRemaining, setTimeRemaining] = useState(1800)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showCertificate, setShowCertificate] = useState(false)
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const topic = searchParams.get('topic') || ''
  const difficulty = searchParams.get('difficulty') || 'beginner'
  const router = useRouter()

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('authToken')
        const response = await apiclient.get('/user/profile/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setUserData(response.data as UserData)
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    }

    fetchUserData()
  }, [])

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const res = await apiclient.post('/user/assessment/quiz/', {
          topic,
          difficulty
        })
        
        const data = res.data as AssessmentData
        setAssessment(data)
        setTimeRemaining(data.time_limit * 60)
      } catch (error) {
        console.error('Error fetching assessment:', error)
      }
    }
    
    if (topic && difficulty) {
      fetchAssessment()
    }
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(prev - 1, 0))
    }, 1000)
    
    return () => clearInterval(timer)
  }, [topic, difficulty])

  const handleAnswer = (questionId: number, optionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }))
  }

  const handleSubmit = async () => {
    try {
      if (!assessment) return

      const res = await apiclient.post('/user/assessment/submit/', {
        assessment_id: assessment.id,
        answers: Object.entries(answers).map(([qId, oId]) => ({
          question_id: parseInt(qId),
          selected_option_id: oId
        }))
      })
      
      const result = res.data as SubmissionResponse
      setSubmissionResult(result)
      
      // Call handleAssessmentComplete regardless of whether the assessment was passed
      await handleAssessmentComplete(result.attempt_id)
      
      if (result.passed) {
        setShowCertificate(true)
      } else {
        alert(`You scored ${result.score}/${assessment.questions.length}. The passing score is ${result.passing_score}. Please try again.`)
        // Go back to the previous page instead of routing to learning page
        router.back()
      }
    } catch (error) {
      console.error('Submission error:', error)
    }
  }

  const handleCertificateGenerated = async () => {
    try {
      const certificateElement = document.getElementById('certificate')
      if (!certificateElement) return

      const canvas = await html2canvas(certificateElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      })
      
      const certificateData = canvas.toDataURL('image/png')
      
      // Store certificate in backend
      const token = localStorage.getItem('authToken')
      await apiclient.post('/user/certificates/', {
        title: `Certificate for ${topic}`,
        course_title: topic,
        completion_date: new Date().toISOString(),
        score: submissionResult?.score || 0,
        total_questions: assessment?.questions.length || 0,
        certificate_data: certificateData
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    } catch (error) {
      console.error('Error storing certificate:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleAssessmentComplete = async (attemptId: number) => {
    try {
      console.log(`Completing assessment with attempt ID: ${attemptId}`)
      // Complete the assessment in the learning path
      const response = await learningPathApi.completeAssessment(attemptId)
      console.log('Response from completeAssessment:', response)
      
      if (response.learning_path) {
        console.log('Learning path received:', response.learning_path)
        // Show completion dialog
        setShowCompletionDialog(true)
        
        // Redirect to learning path
        
      } else {
        console.error('No learning path received from server')
        alert('Failed to generate learning path. Please try again.')
      }
    } catch (error) {
      console.error('Failed to complete assessment:', error)
      alert('Failed to complete assessment. Please try again.')
    }
  }

  if (!assessment) return <div className="p-4">Loading assessment...</div>

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <div className="container px-4 py-6 md:px-6 md:py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to dashboard</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{assessment.title}</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Question {currentQuestion + 1} of {assessment.questions.length}</CardTitle>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Time remaining: {formatTime(timeRemaining)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    {assessment.questions[currentQuestion].text}
                  </h3>
                  <RadioGroup 
                    value={(answers[assessment.questions[currentQuestion].id] || '').toString()}
                    onValueChange={(value) => handleAnswer(assessment.questions[currentQuestion].id, parseInt(value))}
                  >
                    {assessment.questions[currentQuestion].options.map(option => (
                      <div key={option.id} className="flex items-start space-x-2 mb-3">
                        <RadioGroupItem value={option.id.toString()} id={`q${assessment.questions[currentQuestion].id}-o${option.id}`} />
                        <Label className="font-normal" htmlFor={`q${assessment.questions[currentQuestion].id}-o${option.id}`}>
                          {option.text}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentQuestion(prev => Math.max(prev - 1, 0))}
                    disabled={currentQuestion === 0}
                  >
                    Previous
                  </Button>
                  <Button 
                    onClick={() => setCurrentQuestion(prev => Math.min(prev + 1, assessment.questions.length - 1))}
                    disabled={currentQuestion === assessment.questions.length - 1}
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-5 gap-2 md:gap-4">
              {assessment.questions.map((q, index) => (
                <Button
                  key={q.id}
                  variant={index === currentQuestion ? "default" 
                    : answers[q.id] ? "outline" 
                    : "ghost"}
                  className="h-10 w-10 p-0 font-medium"
                  onClick={() => setCurrentQuestion(index)}
                >
                  {index + 1}
                </Button>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Questions Answered</span>
                    <span className="text-sm">{Object.keys(answers).length}/{assessment.questions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Time Elapsed</span>
                    <span className="text-sm">{formatTime(1800 - timeRemaining)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Time Remaining</span>
                    <span className="text-sm">{formatTime(timeRemaining)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assessment Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-1">Description</h3>
                    <p className="text-sm text-gray-500">
                      {assessment.description}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-1">Passing Score</h3>
                    <p className="text-sm text-gray-500">{assessment.passing_score}% ({Math.round(assessment.questions.length * (assessment.passing_score/100))}/{assessment.questions.length} questions)</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-1">Time Limit</h3>
                    <p className="text-sm text-gray-500">{assessment.time_limit / 60} minutes</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" size="sm">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Get Help
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Submit Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Once submitted, you will not be able to change your answers. Make sure you have reviewed all questions
                  before submitting.
                </p>
                <Button 
                  className="w-full" 
                  variant="destructive"
                  onClick={handleSubmit}
                  disabled={timeRemaining === 0 || Object.keys(answers).length < assessment.questions.length}
                >
                  Submit Assessment
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Congratulations! You've Passed!
              </DialogTitle>
              <DialogDescription>
                You have successfully completed the assessment with a score of {submissionResult?.score}/{assessment.questions.length}
              </DialogDescription>
            </DialogHeader>
            
            <Certificate
              userName={userData?.first_name && userData?.last_name 
                ? `${userData.first_name} ${userData.last_name}`
                : userData?.username || 'User'}
              courseTitle={topic}
              completionDate={new Date().toLocaleDateString()}
              score={submissionResult?.score || 0}
              totalQuestions={assessment.questions.length}
              onGenerated={handleCertificateGenerated}
            />
            
            <DialogFooter>
              <Button onClick={() => setShowCertificate(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}