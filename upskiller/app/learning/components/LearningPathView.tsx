import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CheckCircle, PlayCircle, FileText, BarChart2 } from "lucide-react"
import { learningPathApi, LearningPath, LearningPathNode } from '@/utils/learningPathApi'
import { useRouter } from 'next/navigation'
import LearningInterface from './LearningInterface'

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

export default function LearningPathView({ courseId }: { courseId: number }) {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<LearningPathNode | null>(null)
  const [showLearningInterface, setShowLearningInterface] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadLearningPath()
  }, [courseId])

  const loadLearningPath = async () => {
    try {
      const path = await learningPathApi.getCurrentPath(courseId)
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
      setShowLearningInterface(false)
      setSelectedNode(null)
    } catch (err) {
      console.error('Failed to complete node:', err)
    }
  }

  const handleNodeClick = (node: LearningPathNode) => {
    setSelectedNode(node)
    setShowLearningInterface(true)
  }

  if (loading) return <div>Loading learning path...</div>
  if (error) return <div className="text-red-500">{error}</div>
  if (!learningPath) return <div>No learning path available</div>

  const completedNodes = learningPath.nodes.filter(node => node.completed).length
  const progress = (completedNodes / learningPath.nodes.length) * 100

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{learningPath.title}</CardTitle>
          <CardDescription className="text-xs">{learningPath.description}</CardDescription>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={progress} className="h-1.5" />
            <span className="text-xs text-gray-500">
              {completedNodes}/{learningPath.nodes.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[300px] overflow-y-auto pr-2">
            <div className="space-y-2">
              {learningPath.nodes.map((node) => (
                <div
                  key={node.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    node.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {node.completed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <ContentTypeIcon type={node.content_type} />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-medium text-sm truncate">{node.concept.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{node.concept.description}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {!node.completed && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleNodeClick(node)}
                      >
                        Start
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedNode && (
        <LearningInterface
          nodeId={selectedNode.id}
          conceptName={selectedNode.concept.name}
          conceptDescription={selectedNode.concept.description}
          onComplete={() => handleNodeComplete(selectedNode.id)}
          isOpen={showLearningInterface}
          onClose={() => {
            setShowLearningInterface(false)
            setSelectedNode(null)
          }}
        />
      )}
    </>
  )
} 