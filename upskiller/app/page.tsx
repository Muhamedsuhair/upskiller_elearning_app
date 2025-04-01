// pages/index.js
"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { GraduationCap, Clock } from "lucide-react"
import apiClient from '@/utils/apiClient'
import { useRouter } from 'next/navigation';

interface Course {
  id: number
  title: string
  description: string
  modules: {
    number: number
    title: string
    content: string
  }[]
  progress: number
  status: string
  last_accessed: string
}

interface UserProfile {
  username: string
  email: string
  first_name: string
  last_name: string
}

interface ProgressSummary {
  completed: number
  in_progress: number
  not_started: number
  total_content: number
  completion_rate: number
}

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null)
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
 

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('authToken') // Get your auth token
        
        // Fetch user profile
        const profileRes = await apiClient.get('/user/profile/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        console.log(profileRes)
        setProfile(profileRes.data as UserProfile)

        // Fetch progress summary
        const progressRes = await apiClient.get('/user/profile/progress_summary/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        console.log(progressRes)
        setProgressSummary(progressRes.data as ProgressSummary)
       

        // Fetch latest courses
        const coursesRes = await apiClient.get('/user/course-content/latest', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        console.log(coursesRes)
        setCourses(coursesRes.data as Course[])
        console.log(courses)

        // Fetch recommended content
        const recommendedRes = await fetch('/api/user-profile/recommended-content/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (recommendedRes.ok) setRecommendedCourses(await recommendedRes.json())

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header Section */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80 sticky top-0 z-10">
        <title>UpSkiller</title>
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">UpSkiller</span>
          </div>
          <nav className="hidden md:flex gap-6">
            <Link 
              href="/login" 
              className="text-sm font-medium px-3 py-2 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-sm relative group"
            >
              <span className="relative z-10">Login</span>
              <span className="absolute inset-0 rounded-md border border-transparent group-hover:border-gray-200 dark:group-hover:border-gray-700 transition-all duration-200 ease-in-out"></span>
            </Link>
            <Link 
              href="/course-selection" 
              className="text-sm font-medium px-3 py-2 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-sm relative group"
            >
              <span className="relative z-10">Select Course</span>
              <span className="absolute inset-0 rounded-md border border-transparent group-hover:border-gray-200 dark:group-hover:border-gray-700 transition-all duration-200 ease-in-out"></span>
            </Link>
            <Link 
              href="/achievements" 
              className="text-sm font-medium px-3 py-2 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-sm relative group"
            >
              <span className="relative z-10">Achievements</span>
              <span className="absolute inset-0 rounded-md border border-transparent group-hover:border-gray-200 dark:group-hover:border-gray-700 transition-all duration-200 ease-in-out"></span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="container px-4 py-6 md:px-6 md:py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {profile?.username || 'User'}!</h1>
          <p className="text-gray-500 dark:text-gray-400">
            You've completed {progressSummary?.completed || 0} lessons this week. Keep up the good work!
          </p>
        </div>

        {/* Progress Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Courses in Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressSummary?.in_progress || 0}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {progressSummary?.completion_rate || 0}% completion rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressSummary?.completed || 0}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                out of {progressSummary?.total_content || 0} total courses
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Not Started</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressSummary?.not_started || 0}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                courses available to start
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressSummary?.completion_rate || 0}%</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                of total content completed
              </p>
            </CardContent>
          </Card>
        </div>
       
        {/* Course Sections */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Top Courses</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {courses.slice(0, 3).map(course => (
              <CourseCard 
                key={course.id} 
                course={course}
              />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">Currently Studying</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.slice(3).map(course => (
              <CourseCard 
                key={course.id} 
                course={course}
              />
            ))}
          </div>
        </div>

        {/* Recommendations Section */}
        {recommendedCourses.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold mb-4">Recommended for You</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recommendedCourses.map(course => (
                <CourseCard 
                  key={course.id} 
                  course={course}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// Course Card Component
const CourseCard = ({ course }: { course: Course }) => {
  const router = useRouter();
  const handleContinue = async () => {
    console.log(course.id)
    router.push(`/learning?courseId=${course.id}`)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{course.title}</CardTitle>
        <CardDescription>{course.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">{course.modules.length} modules</span>
          </div>
          <div className="text-sm font-medium">{course.progress}%</div>
        </div>
        <Progress value={course.progress} className="h-2" />
        <div className="mt-4 flex justify-between items-center">
          <span className="text-sm text-gray-500">Last accessed: {new Date(course.last_accessed).toLocaleDateString()}</span>
          <Button size="sm" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}