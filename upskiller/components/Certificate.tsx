"use client"

import { Button } from "@/components/ui/button"
import { Download,GraduationCap  } from "lucide-react"
import html2canvas from "html2canvas"
import { useEffect, useRef } from "react"

interface CertificateProps {
  userName: string
  courseTitle: string
  completionDate: string
  score: number
  totalQuestions: number
  onGenerated?: () => Promise<void>
}

export default function Certificate({ userName, courseTitle, completionDate, score, totalQuestions, onGenerated }: CertificateProps) {
  const hasGenerated = useRef(false)

  useEffect(() => {
    // Call onGenerated only once after the component is mounted
    if (onGenerated && !hasGenerated.current) {
      hasGenerated.current = true
      onGenerated()
    }
  }, [onGenerated])

  const handleDownload = async () => {
    const certificateElement = document.getElementById('certificate')
    if (certificateElement) {
      const canvas = await html2canvas(certificateElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      })
      
      const link = document.createElement('a')
      link.download = `certificate-${courseTitle.toLowerCase().replace(/\s+/g, '-')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }

  return (
    <div className="relative">
      <div id="certificate" className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-200">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
           <GraduationCap className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Certificate of Achievement</h1>
              <p className="text-gray-600">This is to certify that</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-600">Date: {completionDate}</p>
            <p className="text-gray-600">Certificate ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">{userName}</h2>
          <p className="text-xl text-gray-600">has successfully completed</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">{courseTitle}</h3>
          <p className="text-xl text-gray-600 mt-2">with a score of {score}/100</p>
        </div>

        <div className="flex justify-between items-end mt-8">
          <div className="text-center">
            <div className="border-t-2 border-gray-300 w-48 mx-auto pt-2">
              <p className="font-semibold">Course Instructor</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-gray-300 w-48 mx-auto pt-2">
              <p className="font-semibold">Upskiller Team</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4">
        <Button onClick={handleDownload} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download Certificate
        </Button>
      </div>
    </div>
  )
} 