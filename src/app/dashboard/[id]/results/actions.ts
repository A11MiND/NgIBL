'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { analyzeStudentAnswers, analyzeIndividualStudent } from '@/lib/ai-simulation'
import { AIProvider } from '@/lib/ai'

export async function analyzeAnswersAction(experimentId: string): Promise<{
  success: boolean
  analysis?: string
  error?: string
}> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Unauthorized' }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      deepseekApiKey: true,
      qwenApiKey: true,
      geminiApiKey: true,
      ollamaBaseUrl: true,
      preferredProvider: true,
      defaultModel: true,
      analysisModel: true,
    }
  })
  if (!user) return { success: false, error: 'User not found' }

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      submissions: {
        include: {
          answers: { include: { question: true } }
        }
      }
    }
  })

  if (!experiment) return { success: false, error: 'Experiment not found' }
  if (experiment.userId !== user.id) return { success: false, error: 'Not authorized' }
  if (experiment.submissions.length === 0) return { success: false, error: 'No submissions to analyze' }

  // Resolve API key & model (analysisModel override > defaultModel)
  const preferred = (user.preferredProvider || 'deepseek') as AIProvider
  let apiKey = ''
  let provider: AIProvider = preferred
  let ollamaBaseUrl: string | undefined
  const model = user.analysisModel || user.defaultModel || undefined

  switch (preferred) {
    case 'deepseek':
      apiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || ''
      break
    case 'qwen':
      apiKey = user.qwenApiKey || ''
      break
    case 'gemini':
      apiKey = process.env.GEMINI_API_KEY || user.geminiApiKey || ''
      break
    case 'ollama':
      ollamaBaseUrl = user.ollamaBaseUrl || 'http://localhost:11434'
      break
  }

  if (!apiKey && provider !== 'ollama') {
    // Fallback
    if (process.env.DEEPSEEK_API_KEY || user.deepseekApiKey) {
      apiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || ''
      provider = 'deepseek'
    } else {
      return { success: false, error: 'No AI provider configured. Please add an API key in Settings.' }
    }
  }

  // Build question-answer structure
  const questionsAndAnswers = experiment.questions.map(q => ({
    question: q.question,
    type: q.type,
    answers: experiment.submissions.map(sub => {
      const ans = sub.answers.find(a => a.questionId === q.id)
      return ans?.value || '(no answer)'
    })
  }))

  return analyzeStudentAnswers(
    questionsAndAnswers,
    experiment.subject,
    apiKey,
    { provider, ollamaBaseUrl, model }
  )
}

export async function analyzeStudentAction(
  experimentId: string,
  submissionId: string
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Unauthorized' }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      deepseekApiKey: true,
      qwenApiKey: true,
      geminiApiKey: true,
      ollamaBaseUrl: true,
      preferredProvider: true,
      defaultModel: true,
      analysisModel: true,
    }
  })
  if (!user) return { success: false, error: 'User not found' }

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      submissions: {
        include: {
          answers: { include: { question: true } }
        }
      }
    }
  })

  if (!experiment) return { success: false, error: 'Experiment not found' }
  if (experiment.userId !== user.id) return { success: false, error: 'Not authorized' }

  const submission = experiment.submissions.find(s => s.id === submissionId)
  if (!submission) return { success: false, error: 'Submission not found' }

  // Resolve API key & model (analysisModel override > defaultModel)
  const preferred = (user.preferredProvider || 'deepseek') as AIProvider
  let apiKey = ''
  let provider: AIProvider = preferred
  let ollamaBaseUrl: string | undefined
  const model = user.analysisModel || user.defaultModel || undefined

  switch (preferred) {
    case 'deepseek':
      apiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || ''
      break
    case 'qwen':
      apiKey = user.qwenApiKey || ''
      break
    case 'gemini':
      apiKey = process.env.GEMINI_API_KEY || user.geminiApiKey || ''
      break
    case 'ollama':
      ollamaBaseUrl = user.ollamaBaseUrl || 'http://localhost:11434'
      break
  }

  if (!apiKey && provider !== 'ollama') {
    if (process.env.DEEPSEEK_API_KEY || user.deepseekApiKey) {
      apiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || ''
      provider = 'deepseek'
    } else {
      return { success: false, error: 'No AI provider configured.' }
    }
  }

  // Build per-student data with class context
  const studentAnswers = experiment.questions.map(q => {
    const studentAns = submission.answers.find(a => a.questionId === q.id)
    const allClassAnswers = experiment.submissions.map(sub => {
      const a = sub.answers.find(a => a.questionId === q.id)
      return a?.value || '(no answer)'
    })
    return {
      question: q.question,
      type: q.type,
      studentAnswer: studentAns?.value || '(no answer)',
      allClassAnswers,
    }
  })

  return analyzeIndividualStudent(
    submission.studentName,
    studentAnswers,
    experiment.subject,
    apiKey,
    { provider, ollamaBaseUrl, model }
  )
}
