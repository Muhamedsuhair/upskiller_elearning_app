"use client"
import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import ModuleRenderer from "./ModuleRenderer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, BarChart2, BarChart3, CheckCircle, Clock, Eye, FileImage, FileText, Headphones, Maximize2, PlayCircle } from "lucide-react"
import apiClient from "@/utils/apiClient"
import AudioPlayer from './components/AudioPlayer'
import InteractiveElement from './components/interactive/InteractiveElement'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface CourseModule {
  id: number
  title: string
  completed: boolean
  current: boolean
  progress: number
  content: string
  number: number
}

interface CourseContent {
  video?: Array<{ id: number; title: string; duration: string; description: string }>
  diagram?: Array<{ id: number; title: string; type: string; description: string }>
  auditory?: Array<{ id: number; title: string; duration: string; description: string }>
  text?: Array<{ id: number; title: string; duration: string; content: string }>
  id: number
  title: string
  description: string
  content_type: string
  modules: CourseModule[]
}

interface Course {
  id: number
  title: string
  progress: number
  time_remaining: string
  current_module: string
  modules: CourseModule[]
  content?: CourseContent
  description: string
  content_type: string
  difficulty_level: string
}

const defaultContent: CourseContent = {
  video: [],
  diagram: [],
  auditory: [],
  text: [],
  id: 0,
  title: '',
  description: '',
  content_type: '',
  modules: []
}

export default function LearningPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const courseId = searchParams.get('courseId')
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<number>(1)
  const [interactiveElements, setInteractiveElements] = useState<Array<{ type: string; config: any; title: string }>>([])
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)

  // Function to extract interactive elements from content
  const extractInteractiveElements = (content: string) => {
    const elements: Array<{ type: string; config: any; title: string }> = [];
    
    // Extract playground elements
    const playgroundRegex = /```playground\s*(\{[\s\S]*?\})\s*```/g;
    let match;
    while ((match = playgroundRegex.exec(content)) !== null) {
      try {
        const config = JSON.parse(match[1]);
        elements.push({
          type: 'playground',
          config,
          title: 'Code Playground'
        });
      } catch (err) {
        console.error('Error parsing playground config:', err);
      }
    }

    // Extract drag-drop elements
    const dragDropRegex = /```drag-drop\s*(\{[\s\S]*?\})\s*```/g;
    while ((match = dragDropRegex.exec(content)) !== null) {
      try {
        const config = JSON.parse(match[1]);
        elements.push({
          type: 'drag-drop',
          config,
          title: 'Drag and Drop Exercise'
        });
      } catch (err) {
        console.error('Error parsing drag-drop config:', err);
      }
    }

    // Extract lab elements
    const labRegex = /```lab\s*(\{[\s\S]*?\})\s*```/g;
    while ((match = labRegex.exec(content)) !== null) {
      try {
        const config = JSON.parse(match[1]);
        elements.push({
          type: 'lab',
          config,
          title: config.title || 'Virtual Lab'
        });
      } catch (err) {
        console.error('Error parsing lab config:', err);
      }
    }

    // Extract simulation elements
    const simulationRegex = /```simulation\s*(\{[\s\S]*?\})\s*```/g;
    while ((match = simulationRegex.exec(content)) !== null) {
      try {
        const config = JSON.parse(match[1]);
        elements.push({
          type: 'simulation',
          config,
          title: 'Interactive Simulation'
        });
      } catch (err) {
        console.error('Error parsing simulation config:', err);
      }
    }

    // Extract reveal elements
    const revealRegex = /```reveal\s*(\{[\s\S]*?\})\s*```/g;
    while ((match = revealRegex.exec(content)) !== null) {
      try {
        const config = JSON.parse(match[1]);
        elements.push({
          type: 'reveal',
          config,
          title: 'Step-by-Step Guide'
        });
      } catch (err) {
        console.error('Error parsing reveal config:', err);
      }
    }

    return elements;
  };

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (!courseId) throw new Error('Course ID not provided')
        const response = await apiClient.get(`/user/course-content/${courseId}/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        const transformModules = (modules: any[]): CourseModule[] => 
          modules?.map((module, index) => ({
            id: module.id || index + 1,
            title: module.title,
            completed: module.status === 'completed',
            current: module.status === 'in_progress',
            progress: module.completion_percentage || 0,
            content: module.content,
            number: module.number
          })) || []

        const courseData: Course = {
          ...response.data as {
            id: number;
            title: string;
            description: string;
            content_type: string;
            modules: any[];
            progress?: { completion_percentage: number };
            content?: {
              video?: Array<{ id: number; title: string; duration: string; description: string }>;
              diagram?: Array<{ id: number; title: string; type: string; description: string }>;
              auditory?: Array<{ id: number; title: string; duration: string; description: string }>;
              text?: Array<{ id: number; title: string; duration: string; content: string }>;
            };
            time_remaining: string;
            current_module: string;
            difficulty_level: string;
          },
          progress: (response.data as any).progress?.completion_percentage || 0,
          modules: transformModules((response.data as any).modules),
          time_remaining: (response.data as any).time_remaining || '0 minutes',
          current_module: (response.data as any).current_module || '',
          difficulty_level: (response.data as any).difficulty_level || 'beginner',
          content: {
            ...defaultContent,
            video: (response.data as any).content?.video || [],
            diagram: (response.data as any).content?.diagram || [],
            auditory: (response.data as any).content?.auditory || [],
            text: (response.data as any).content?.text || [],
            id: (response.data as any).id,
            title: (response.data as any).title,
            description: (response.data as any).description,
            content_type: (response.data as any).content_type,
            modules: transformModules((response.data as any).modules)
          }
        }
        
        setCourse(courseData)

        // Extract interactive elements from current module content
        if (courseData.modules.length > 0) {
          const currentModule = courseData.modules[0];
          const elements = extractInteractiveElements(currentModule.content);
          setInteractiveElements(elements);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch course')
      } finally {
        setLoading(false)
      }
    }
    
    fetchCourse()
  }, [courseId])

  // Update interactive elements when module changes
  useEffect(() => {
    if (course && currentModule) {
      const elements = extractInteractiveElements(currentModule.content);
      setInteractiveElements(elements);
    }
  }, [selectedModule, course]);

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>
  if (error) return <div className="flex justify-center items-center h-screen text-red-500">Error: {error}</div>
  if (!course) return <div className="flex justify-center items-center h-screen">Course not found</div>

  const currentModule = course.modules.find(m => m.number === selectedModule)
  const currentModuleIndex = course.modules.findIndex(m => m.number === selectedModule)
  const handleModuleSelect = (moduleNumber: number) => setSelectedModule(moduleNumber)

  const handleNextModule = async () => {
    if (!course) return;
    
    const currentModuleIndex = course.modules.findIndex(m => m.number === selectedModule);
    if (currentModuleIndex === -1) return;

    try {
      const token = localStorage.getItem('authToken');
      
      // Calculate progress based on completed modules
      const completedModules = course.modules.filter(m => m.completed).length + 1; // +1 for current module
      const totalModules = course.modules.length;
      const progressPercentage = Math.round((completedModules / totalModules) * 100);
      
      // Determine if this is the last module
      const isLastModule = currentModuleIndex === course.modules.length - 1;
      
      // Mark current module as completed using the UserProfileViewSet endpoint
      const response = await apiClient.post(`/user/profile/update_progress/`, {
        content_id: course.id,
        status: isLastModule ? 'completed' : 'in_progress',
        completion_percentage: progressPercentage
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Update local state
      const updatedModules = [...course.modules];
      
      // Update current module status
      updatedModules[currentModuleIndex] = {
        ...updatedModules[currentModuleIndex],
        completed: true,
        current: false,
        progress: 100
      };

      // If there's a next module, mark it as current
      if (currentModuleIndex + 1 < updatedModules.length) {
        updatedModules[currentModuleIndex + 1] = {
          ...updatedModules[currentModuleIndex + 1],
          current: true,
          progress: 0
        };
      }

      // Update course state with new progress
      setCourse({
        ...course,
        modules: updatedModules,
        progress: progressPercentage,
        current_module: updatedModules[currentModuleIndex + 1]?.title || course.current_module
      });

      // If this is the last module, show completion dialog
      if (isLastModule) {
        setShowCompletionDialog(true);
      } else {
        // Navigate to next module
        setSelectedModule(selectedModule + 1);
      }

      // Refresh the course data to ensure we have the latest state
      const refreshResponse = await apiClient.get(`/user/course-content/${course.id}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (refreshResponse.data) {
        const refreshedData = refreshResponse.data as Course;
        // Transform modules to ensure proper progress tracking
        const transformedModules = refreshedData.modules.map((module, index) => ({
          ...module,
          completed: index < currentModuleIndex + 1,
          current: index === currentModuleIndex + 1,
          progress: index < currentModuleIndex + 1 ? 100 : index === currentModuleIndex + 1 ? 0 : module.progress
        }));

        setCourse(prevCourse => ({
          ...prevCourse!,
          ...refreshedData,
          modules: transformedModules,
          progress: progressPercentage
        }));
      }
    } catch (error) {
      console.error('Error completing module:', error);
    }
  };

  const handleStartAssessment = () => {
    if (!course) return;
    // Navigate to assessment page with course title and difficulty level
    router.push(`/assessment?topic=${encodeURIComponent(course.title)}&difficulty=${encodeURIComponent(course.difficulty_level)}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <title>Learning - {course.title}</title>
      <div className="container px-4 py-6 md:px-6 md:py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to dashboard</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{course.title}</h1>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{course.title}</CardTitle>
                <CardDescription>{course.current_module}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Progress: {course.progress}%</div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-500">{course.time_remaining} left</span>
                  </div>
                </div>
                <Progress value={course.progress} className="h-2" />
              </CardContent>
            </Card>
            <Tabs defaultValue="visual">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="visual" className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  <span>Video</span>
                </TabsTrigger>
                <TabsTrigger value="kinesthetics" className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  <span>Interactive</span>
                </TabsTrigger>
                <TabsTrigger value="auditory" className="flex items-center gap-2">
                  <Headphones className="h-4 w-4" />
                  <span>Auditory</span>
                </TabsTrigger>
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Text</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-6 space-y-4 h-[600px] overflow-y-auto relative">
                {currentModule && (
                  <>
                    <ModuleRenderer 
                      modules={[currentModule]} 
                      key={currentModule.number}
                    />
                    <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-900 py-4 border-t">
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleNextModule}
                          className="flex items-center gap-2"
                          disabled={!course}
                        >
                          {currentModule.completed ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Completed
                            </>
                          ) : currentModuleIndex === course.modules.length - 1 ? (
                            <>
                              Finish Course
                              <CheckCircle className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Next Module
                              <ArrowLeft className="h-4 w-4 rotate-180" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
              <TabsContent value="kinesthetics" className="mt-6 h-[600px] overflow-y-auto relative">
                {interactiveElements.length > 0 ? (
                  <div className="space-y-6">
                    {interactiveElements.map((item, index) => (
                      <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
                        <InteractiveElement
                          type={item.type as 'playground' | 'lab' | 'simulation' | 'drag-drop' | 'reveal'}
                          config={item.config}
                          title={item.title}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Interactive Content</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      This module doesn't have any interactive elements yet.
                    </p>
                  </div>
                )}
                <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-900 py-4 border-t">
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleNextModule}
                      className="flex items-center gap-2"
                      disabled={!course}
                    >
                      {currentModule?.completed ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Completed
                        </>
                      ) : currentModuleIndex === course.modules.length - 1 ? (
                        <>
                          Finish Course
                          <CheckCircle className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Next Module
                          <ArrowLeft className="h-4 w-4 rotate-180" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="auditory" className="mt-6 h-[600px] overflow-y-auto relative">
                <AudioPlayer
                  content={currentModule?.content || ''}
                  moduleTitle={currentModule?.title || 'Module Content'}
                />
                <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-900 py-4 border-t">
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleNextModule}
                      className="flex items-center gap-2"
                      disabled={!course}
                    >
                      {currentModule?.completed ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Completed
                        </>
                      ) : currentModuleIndex === course.modules.length - 1 ? (
                        <>
                          Finish Course
                          <CheckCircle className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Next Module
                          <ArrowLeft className="h-4 w-4 rotate-180" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Course Modules</CardTitle>
                <CardDescription>Track your progress</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {course.modules.map((module) => (
                    <li 
                      key={module.id} 
                      className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded"
                      onClick={() => handleModuleSelect(module.number)}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="selectedModule"
                          checked={selectedModule === module.number}
                          onChange={() => handleModuleSelect(module.number)}
                          className="h-4 w-4 text-primary"
                        />
                        {module.completed ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : module.current ? (
                          <div className="h-5 w-5 rounded-full border-2 border-primary mt-0.5" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-300 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium">{module.title}</p>
                          <p className="text-sm text-gray-500">
                            {module.completed 
                              ? 'Completed' 
                              : module.current 
                              ? `In progress (${module.progress}%)` 
                              : 'Not started'}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  View All Modules
                </Button>
              </CardFooter>
            </Card>
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Learning Preferences</CardTitle>
                <CardDescription>Customize your experience</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Preferred Learning Style</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <Button size="sm" variant="outline" className="justify-start">
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Visual
                      </Button>
                      <Button size="sm" variant="outline" className="justify-start">
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Diagram
                      </Button>
                      <Button size="sm" variant="outline" className="justify-start">
                        <Headphones className="h-4 w-4 mr-2" />
                        Auditory
                      </Button>
                      <Button size="sm" variant="default" className="justify-start">
                        <FileText className="h-4 w-4 mr-2" />
                        Text
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Learning Schedule</h3>
                    <p className="text-sm text-gray-500">
                      You typically learn in the evenings between 7-9 PM. Next scheduled session: Today at 7:00 PM
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Learning Goals</h3>
                    <p className="text-sm text-gray-500">
                      Current goal: {course.current_module} by Friday
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  Update Preferences
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Congratulations! 🎉</DialogTitle>
            <DialogDescription>
              You have successfully completed the course "{course?.title}". Now, let's test your knowledge with an assessment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleStartAssessment}>
              Start Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}