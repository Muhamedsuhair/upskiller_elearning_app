import apiClient from './apiClient'

export interface LearningPathNode {
  id: number
  concept: {
    id: number
    name: string
    description: string
  }
  content_type: 'video' | 'text' | 'interactive' | 'assessment'
  content_id: string
  completed: boolean
  order: number
}

export interface LearningPath {
  id: number
  title: string
  description: string
  nodes: LearningPathNode[]
}

export const learningPathApi = {
  getCurrentPath: async (): Promise<LearningPath> => {
    const response = await apiClient.get('/user/assessment/learning-path/')
    return response.data as LearningPath
  },

  completeAssessment: async (attemptId: number): Promise<{ learning_path: LearningPath }> => {
    console.log(`Making API request to complete assessment with attempt ID: ${attemptId}`)
    console.log(`API URL: /user/assessment/complete-assessment/${attemptId}/`)
    const response = await apiClient.post(`/user/assessment/complete-assessment/${attemptId}/`)
    console.log('API response:', response.data)
    return response.data as { learning_path: LearningPath }
  },

  completeLearningNode: async (nodeId: number): Promise<void> => {
    await apiClient.post(`/user/assessment/complete-learning-node/${nodeId}/`)
  }
} 