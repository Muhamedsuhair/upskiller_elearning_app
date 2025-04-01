"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import apiclient from "@/utils/apiClient"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui"
import { Button } from "@/components/ui/button"
import { Download, Trophy } from "lucide-react"

interface Certificate {
  id: number
  title: string
  course_title: string
  completion_date: string
  score: number
  total_questions: number
  certificate_data: string
}

export default function AchievementsPage() {
  const router = useRouter()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const token = localStorage.getItem('authToken')
        const response = await apiclient.get('/user/certificates/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setCertificates(response.data as Certificate[])
      } catch (error) {
        console.error('Error fetching certificates:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCertificates()
  }, [])

  const handleDownload = (certificateData: string, courseTitle: string) => {
    const link = document.createElement('a')
    link.download = `certificate-${courseTitle.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = certificateData
    link.click()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading certificates...</p>
        </div>
      </div>
    )
  }

  if (certificates.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Certificates Yet</h2>
          <p className="text-gray-600 mb-6">Complete assessments to earn certificates!</p>
          <Button onClick={() => router.push('/')}>
            Start Learning
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-3xl font-bold mb-8">Your Achievements</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {certificates.map((certificate) => (
          <Card key={certificate.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>{certificate.title}</CardTitle>
              <CardDescription>
                Completed on {new Date(certificate.completion_date).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Course</p>
                  <p className="text-lg font-semibold">{certificate.course_title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Score</p>
                  <p className="text-lg font-semibold">{certificate.score}/100</p>
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => handleDownload(certificate.certificate_data, certificate.course_title)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Certificate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 