import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CheckCircle, PlayCircle, FileText, BarChart2 } from "lucide-react"
import { learningPathApi, LearningPath, LearningPathNode } from '@/utils/learningPathApi'
import { useRouter } from 'next/navigation'

const ContentTypeIcon = ({ type }: { type: LearningPathNode['content_type'] }) => {
  switch (type) {
    case 'video':
      return <PlayCircle className="h-4 w-4" />
    case 'text':
      return <FileText className="h-4 w-4" />
    case 'interactive':
      return <BarChart2 className="h-4 w-4" />
    default:
      return null
  }
}

export default function LearningPathView() {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadLearningPath()
  }, [])

  const loadLearningPath = async () => {
    try {
      const path = await learningPathApi.getCurrentPath()
      setLearningPath(path)
    } catch (err) {
      setError('Failed to load learning path')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleNodeComplete = async (nodeId: number) => {
    try {
      await learningPathApi.completeLearningNode(nodeId)
      await loadLearningPath() // Reload to get updated state
    } catch (err) {
      console.error('Failed to complete node:', err)
    }
  }

  const handleNodeClick = (node: LearningPathNode) => {
    // Navigate to the appropriate content based on type
    switch (node.content_type) {
      case 'video':
        router.push(`/learning/video/${node.content_id}`)
        break
      case 'text':
        router.push(`/learning/text/${node.content_id}`)
        break
      case 'interactive':
        router.push(`/learning/interactive/${node.content_id}`)
        break
      case 'assessment':
        router.push(`/assessment/${node.content_id}`)
        break
    }
  }

  if (loading) return <div>Loading learning path...</div>
  if (error) return <div className="text-red-500">{error}</div>
  if (!learningPath) return <div>No learning path available</div>

  const completedNodes = learningPath.nodes.filter(node => node.completed).length
  const progress = (completedNodes / learningPath.nodes.length) * 100

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{learningPath.title}</CardTitle>
        <CardDescription>{learningPath.description}</CardDescription>
        <div className="flex items-center gap-2 mt-2">
          <Progress value={progress} className="h-2" />
          <span className="text-sm text-gray-500">
            {completedNodes} of {learningPath.nodes.length} completed
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {learningPath.nodes.map((node) => (
            <div
              key={node.id}
              className={`flex items-center gap-4 p-4 rounded-lg border ${
                node.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex-shrink-0">
                {node.completed ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <ContentTypeIcon type={node.content_type} />
                )}
              </div>
              <div className="flex-grow">
                <h3 className="font-medium">{node.concept.name}</h3>
                <p className="text-sm text-gray-500">{node.concept.description}</p>
              </div>
              <div className="flex-shrink-0">
                {!node.completed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNodeClick(node)}
                  >
                    Start
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 