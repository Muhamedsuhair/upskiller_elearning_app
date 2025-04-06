import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PlayCircle, FileText, BarChart2, CheckCircle } from "lucide-react"
import apiClient from '@/utils/apiClient'
import InteractiveElement from './interactive/InteractiveElement'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface LearningContent {
  content: string
  content_id: string
  content_type: 'video' | 'text' | 'interactive'
}

interface LearningInterfaceProps {
  nodeId: number
  conceptName: string
  conceptDescription: string
  onComplete: () => void
  isOpen: boolean
  onClose: () => void
}

export default function LearningInterface({ 
  nodeId, 
  conceptName, 
  conceptDescription, 
  onComplete,
  isOpen,
  onClose
}: LearningInterfaceProps) {
  const [content, setContent] = useState<LearningContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [parsedContent, setParsedContent] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'video' | 'text' | 'interactive'>('text')

  useEffect(() => {
    if (isOpen) {
      generateContent()
    }
  }, [nodeId, isOpen])

  const generateContent = async () => {
    try {
      setLoading(true)
      const response = await apiClient.post(`/user/assessment/generate-learning-content/${nodeId}/`)
      const responseData = response.data as LearningContent
      setContent(responseData)
      
      setActiveTab(responseData.content_type)
      
      if (responseData.content_type === 'interactive') {
        try {
          let contentToParse = responseData.content
          
          if (typeof contentToParse === 'string') {
            if (contentToParse.startsWith('```json')) {
              contentToParse = contentToParse.substring(7)
            }
            if (contentToParse.endsWith('```')) {
              contentToParse = contentToParse.substring(0, contentToParse.length - 3)
            }
            contentToParse = contentToParse.trim()
            
            const parsed = JSON.parse(contentToParse)
            setParsedContent(parsed)
          } else {
            setParsedContent(contentToParse)
          }
        } catch (parseError) {
          console.error('Error parsing interactive content:', parseError)
          setParsedContent(null)
        }
      }
    } catch (err) {
      setError('Failed to generate learning content')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleProgressUpdate = (newProgress: number) => {
    setProgress(newProgress)
    if (newProgress >= 100) {
      onComplete()
    }
  }

  const renderContent = () => {
    if (!content) return null

    const contentWrapper = (children: React.ReactNode) => (
      <div className="h-full w-full overflow-auto rounded-md border bg-background p-6">
        {children}
      </div>
    )

    switch (content.content_type) {
      case 'video':
      case 'text':
        return contentWrapper(
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
            >
              {content.content}
            </ReactMarkdown>
          </div>
        )
      case 'interactive':
        if (parsedContent) {
          return contentWrapper(
            <InteractiveElement
              type={parsedContent.type || "simulation"}
              config={parsedContent.config || parsedContent}
              title={parsedContent.title || conceptName}
            />
          )
        } else {
          return contentWrapper(
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
              >
                {content.content}
              </ReactMarkdown>
            </div>
          )
        }
      default:
        return <div>Unsupported content type</div>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-4">
          <DialogTitle>{conceptName}</DialogTitle>
          <DialogDescription>{conceptDescription}</DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-2 mb-4">
          <Progress value={progress} className="h-2" />
          <span className="text-sm text-gray-500 whitespace-nowrap">{progress}% complete</span>
        </div>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-lg">Generating learning content...</div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-red-500">{error}</div>
          </div>
        ) : !content ? (
          <div className="flex-1 flex items-center justify-center">
            <div>No content available</div>
          </div>
        ) : (
          <Tabs 
            value={activeTab} 
            onValueChange={(value) => setActiveTab(value as any)} 
            className="flex-1 flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="video" className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                Video
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Text
              </TabsTrigger>
              <TabsTrigger value="interactive" className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Interactive
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 relative">
              <TabsContent value="video" className="h-full absolute inset-0">
                {renderContent()}
              </TabsContent>
              
              <TabsContent value="text" className="h-full absolute inset-0">
                {renderContent()}
              </TabsContent>
              
              <TabsContent value="interactive" className="h-full absolute inset-0">
                {renderContent()}
              </TabsContent>
            </div>
          </Tabs>
        )}

        <div className="flex justify-end mt-4">
          <Button 
            onClick={onComplete}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Mark as Complete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}