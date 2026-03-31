'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { analyzeStudentAnswers, analyzeIndividualStudent } from '@/lib/ai-simulation'
import { AIProvider, inferProviderFromModel } from '@/lib/ai'
import { cached, cacheDelete, CacheKeys } from '@/lib/cache'
import { rateLimit } from '@/lib/rate-limit'
import { logger, logAI } from '@/lib/logger'

type AnalysisRuntime = {
  apiKey: string
  provider: AIProvider
  ollamaBaseUrl?: string
  model?: string
}

type QuestionBreakdown = {
  question: string
  correctPct: number
  partialPct: number
  incorrectPct: number
}

async function persistQuestionSnapshots(params: {
  experimentId: string
  questionIds: string[]
  chartData: QuestionBreakdown[]
  className?: string
}) {
  if (!params.chartData.length) return
  await prisma.questionMetricSnapshot.createMany({
    data: params.chartData.map((row, idx) => ({
      experimentId: params.experimentId,
      questionId: params.questionIds[idx] || `index_${idx}`,
      className: params.className || null,
      correctPct: row.correctPct,
      partialPct: row.partialPct,
      incorrectPct: row.incorrectPct,
      sampleSize: 0,
    })),
  })
}

async function resolveAnalysisRuntime(user: {
  deepseekApiKey: string | null
  qwenApiKey: string | null
  geminiApiKey: string | null
  ollamaBaseUrl: string | null
  preferredProvider: string | null
  defaultModel: string | null
  analysisModel: string | null
}): Promise<AnalysisRuntime | { error: string }> {
  const model = user.analysisModel || user.defaultModel || undefined
  const inferredProvider = model ? inferProviderFromModel(model) : null
  const preferred = (inferredProvider || user.preferredProvider || 'deepseek') as AIProvider
  let apiKey = ''
  let provider: AIProvider = preferred
  let ollamaBaseUrl: string | undefined

  switch (preferred) {
    case 'deepseek':
      apiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || ''
      break
    case 'qwen':
      apiKey = process.env.QWEN_API_KEY || user.qwenApiKey || ''
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
      return { error: 'No AI provider configured. Please add an API key in Settings.' }
    }
  }

  return { apiKey, provider, ollamaBaseUrl, model }
}

export async function analyzeAnswersAction(experimentId: string): Promise<{
  success: boolean
  analysis?: string
  chartData?: Array<{ question: string; correctPct: number; partialPct: number; incorrectPct: number }>
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

  // ─── Rate Limiting ──────────────────────────────────────────────
  const rateLimitResult = await rateLimit(user.id, 'analysis')
  if (!rateLimitResult.success) {
    return { success: false, error: `Rate limit exceeded. Please wait before requesting another analysis. (${rateLimitResult.remaining} remaining)` }
  }

  // ─── Check Cache ────────────────────────────────────────────────
  const cacheKey = CacheKeys.classAnalysis(experimentId)
  const cachedResult = await (await import('@/lib/cache')).cacheGet<{
    analysis: string
    chartData?: Array<{ question: string; correctPct: number; partialPct: number; incorrectPct: number }>
  }>(cacheKey)
  if (cachedResult) {
    logger.info({ experimentId, cached: true }, 'Class analysis served from cache')
    return { success: true, ...cachedResult }
  }

  const runtime = await resolveAnalysisRuntime(user)
  if ('error' in runtime) return { success: false, error: runtime.error }
  const { apiKey, provider, ollamaBaseUrl, model } = runtime

  // Build question-answer structure
  const questionsAndAnswers = experiment.questions.map(q => ({
    question: q.question,
    type: q.type,
    answers: experiment.submissions.map(sub => {
      const ans = sub.answers.find(a => a.questionId === q.id)
      return ans?.value || '(no answer)'
    })
  }))

  const startTime = Date.now()
  const result = await analyzeStudentAnswers(
    questionsAndAnswers,
    experiment.subject,
    apiKey,
    { provider, ollamaBaseUrl, model }
  )

  logAI('class_analysis', {
    provider,
    model,
    duration: Date.now() - startTime,
    cached: false,
  })

  // Cache the result for 1 hour
  if (result.success && result.analysis) {
    await prisma.analysisRun.create({
      data: {
        experimentId,
        kind: 'CLASS_ANALYSIS',
        status: 'SUCCESS',
        provider,
        model: model || null,
        durationMs: Date.now() - startTime,
        metadata: { submissionCount: experiment.submissions.length },
      },
    })
    await persistQuestionSnapshots({
      experimentId,
      questionIds: experiment.questions.map((q) => q.id),
      chartData: result.chartData || [],
    })
    const { cacheSet } = await import('@/lib/cache')
    cacheSet(cacheKey, { analysis: result.analysis, chartData: result.chartData }, 3600).catch(() => {})
  }

  return result
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

  // ─── Rate Limiting ──────────────────────────────────────────────
  const rateLimitResult = await rateLimit(user.id, 'analysis')
  if (!rateLimitResult.success) {
    return { success: false, error: `Rate limit exceeded. Please wait before requesting another analysis.` }
  }

  // ─── Check Cache ────────────────────────────────────────────────
  const studentCacheKey = CacheKeys.studentAnalysis(experimentId, submissionId)
  const cachedStudent = await (await import('@/lib/cache')).cacheGet<{ analysis: string }>(studentCacheKey)
  if (cachedStudent) {
    logger.info({ experimentId, submissionId, cached: true }, 'Student analysis served from cache')
    return { success: true, analysis: cachedStudent.analysis }
  }

  const runtime = await resolveAnalysisRuntime(user)
  if ('error' in runtime) return { success: false, error: runtime.error }
  const { apiKey, provider, ollamaBaseUrl, model } = runtime

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

  const studentStartTime = Date.now()
  const studentResult = await analyzeIndividualStudent(
    submission.studentName,
    studentAnswers,
    experiment.subject,
    apiKey,
    { provider, ollamaBaseUrl, model }
  )

  logAI('student_analysis', {
    provider,
    model,
    duration: Date.now() - studentStartTime,
    cached: false,
  })

  // Cache the result for 1 hour
  if (studentResult.success && studentResult.analysis) {
    const answeredCount = studentAnswers.filter((x) => x.studentAnswer && x.studentAnswer !== '(no answer)').length
    const progressScore = Math.round((answeredCount / Math.max(studentAnswers.length, 1)) * 1000) / 10
    await prisma.analysisRun.create({
      data: {
        experimentId,
        kind: 'STUDENT_ANALYSIS',
        status: 'SUCCESS',
        provider,
        model: model || null,
        durationMs: Date.now() - studentStartTime,
        metadata: { submissionId, studentName: submission.studentName },
      },
    })
    await prisma.studentProgressSnapshot.create({
      data: {
        experimentId,
        studentId: submission.studentId,
        studentName: submission.studentName,
        className: submission.class,
        submissionId: submission.id,
        progressScore,
        metrics: {
          answeredCount,
          totalQuestions: studentAnswers.length,
        },
      },
    })
    const { cacheSet } = await import('@/lib/cache')
    cacheSet(studentCacheKey, { analysis: studentResult.analysis }, 3600).catch(() => {})
  }

  return studentResult
}

export async function compareTwoClassesAction(
  experimentId: string,
  classA: string,
  classB: string
): Promise<{
  success: boolean
  classA?: string
  classB?: string
  classAStats?: { avgCorrect: number; avgPartial: number; avgIncorrect: number }
  classBStats?: { avgCorrect: number; avgPartial: number; avgIncorrect: number }
  perQuestion?: Array<{
    question: string
    classACorrect: number
    classBCorrect: number
    classAIncorrect: number
    classBIncorrect: number
    correctDelta: number
    incorrectDelta: number
  }>
  hotspots?: Array<{ question: string; incorrectPct: number; weakerClass: string }>
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
    },
  })
  if (!user) return { success: false, error: 'User not found' }

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      submissions: {
        include: {
          answers: { include: { question: true } },
        },
      },
    },
  })

  if (!experiment) return { success: false, error: 'Experiment not found' }
  if (experiment.userId !== user.id) return { success: false, error: 'Not authorized' }
  if (!classA || !classB || classA === classB) {
    return { success: false, error: 'Please choose two different classes.' }
  }

  const submissionsA = experiment.submissions.filter((s) => s.class === classA)
  const submissionsB = experiment.submissions.filter((s) => s.class === classB)
  if (submissionsA.length === 0 || submissionsB.length === 0) {
    return { success: false, error: 'One of the selected classes has no submissions.' }
  }

  const rateLimitResult = await rateLimit(user.id, 'analysis')
  if (!rateLimitResult.success) {
    return { success: false, error: 'Rate limit exceeded. Please wait before requesting another analysis.' }
  }

  const runtime = await resolveAnalysisRuntime(user)
  if ('error' in runtime) return { success: false, error: runtime.error }
  const { apiKey, provider, ollamaBaseUrl, model } = runtime

  const buildQa = (subs: typeof experiment.submissions) =>
    experiment.questions.map((q) => ({
      question: q.question,
      type: q.type,
      answers: subs.map((sub) => {
        const ans = sub.answers.find((a) => a.questionId === q.id)
        return ans?.value || '(no answer)'
      }),
    }))

  const [resultA, resultB] = await Promise.all([
    analyzeStudentAnswers(buildQa(submissionsA), experiment.subject, apiKey, { provider, ollamaBaseUrl, model }),
    analyzeStudentAnswers(buildQa(submissionsB), experiment.subject, apiKey, { provider, ollamaBaseUrl, model }),
  ])

  if (!resultA.success || !resultB.success) {
    return { success: false, error: resultA.error || resultB.error || 'Class comparison failed' }
  }

  const dataA: QuestionBreakdown[] = resultA.chartData || []
  const dataB: QuestionBreakdown[] = resultB.chartData || []
  const maxLen = Math.max(dataA.length, dataB.length)
  const perQuestion = Array.from({ length: maxLen }).map((_, i) => {
    const qa = dataA[i] || { question: `Q${i + 1}`, correctPct: 0, partialPct: 0, incorrectPct: 0 }
    const qb = dataB[i] || { question: qa.question, correctPct: 0, partialPct: 0, incorrectPct: 0 }
    return {
      question: qa.question || qb.question,
      classACorrect: qa.correctPct,
      classBCorrect: qb.correctPct,
      classAIncorrect: qa.incorrectPct,
      classBIncorrect: qb.incorrectPct,
      correctDelta: Math.round((qa.correctPct - qb.correctPct) * 10) / 10,
      incorrectDelta: Math.round((qa.incorrectPct - qb.incorrectPct) * 10) / 10,
    }
  })

  const avg = (items: QuestionBreakdown[], key: keyof QuestionBreakdown) =>
    items.length ? Math.round((items.reduce((sum, item) => sum + Number(item[key]), 0) / items.length) * 10) / 10 : 0

  const classAStats = {
    avgCorrect: avg(dataA, 'correctPct'),
    avgPartial: avg(dataA, 'partialPct'),
    avgIncorrect: avg(dataA, 'incorrectPct'),
  }
  const classBStats = {
    avgCorrect: avg(dataB, 'correctPct'),
    avgPartial: avg(dataB, 'partialPct'),
    avgIncorrect: avg(dataB, 'incorrectPct'),
  }

  const hotspots = perQuestion
    .map((row) => ({
      question: row.question,
      incorrectPct: Math.max(row.classAIncorrect, row.classBIncorrect),
      weakerClass: row.classAIncorrect >= row.classBIncorrect ? classA : classB,
    }))
    .sort((a, b) => b.incorrectPct - a.incorrectPct)
    .slice(0, 5)

  await prisma.analysisRun.create({
    data: {
      experimentId,
      kind: 'CLASS_COMPARE',
      classA,
      classB,
      status: 'SUCCESS',
      provider,
      model: model || null,
      metadata: {
        submissionsA: submissionsA.length,
        submissionsB: submissionsB.length,
      },
    },
  })

  await Promise.all([
    persistQuestionSnapshots({
      experimentId,
      questionIds: experiment.questions.map((q) => q.id),
      chartData: dataA,
      className: classA,
    }),
    persistQuestionSnapshots({
      experimentId,
      questionIds: experiment.questions.map((q) => q.id),
      chartData: dataB,
      className: classB,
    }),
  ])

  return {
    success: true,
    classA,
    classB,
    classAStats,
    classBStats,
    perQuestion,
    hotspots,
  }
}

export async function getProgressOverviewAction(
  experimentId: string,
  className?: string
): Promise<{
  success: boolean
  classAverages?: Array<{ className: string; avgProgress: number; students: number }>
  studentRows?: Array<{ studentId: string; studentName: string; className: string; progress: number; submittedAt: string }>
  error?: string
}> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Unauthorized' }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      submissions: {
        orderBy: { submittedAt: 'desc' },
        include: {
          answers: true,
        },
      },
    },
  })

  if (!experiment) return { success: false, error: 'Experiment not found' }
  if (experiment.userId !== user.id) return { success: false, error: 'Not authorized' }

  const totalQuestions = Math.max(experiment.questions.length, 1)
  const filtered = className
    ? experiment.submissions.filter((s) => s.class === className)
    : experiment.submissions

  const latestByStudent = new Map<string, { studentId: string; studentName: string; className: string; progress: number; submittedAt: string }>()

  for (const sub of filtered) {
    if (latestByStudent.has(sub.studentId)) continue
    const answered = sub.answers.filter((a) => a.value && a.value.trim() && a.value.trim().toLowerCase() !== 'no answer').length
    const progress = Math.round((answered / totalQuestions) * 1000) / 10
    latestByStudent.set(sub.studentId, {
      studentId: sub.studentId,
      studentName: sub.studentName,
      className: sub.class,
      progress,
      submittedAt: sub.submittedAt.toISOString(),
    })
  }

  const studentRows = Array.from(latestByStudent.values()).sort((a, b) => b.progress - a.progress)

  const classMap = new Map<string, { sum: number; count: number }>()
  for (const row of studentRows) {
    const current = classMap.get(row.className) || { sum: 0, count: 0 }
    current.sum += row.progress
    current.count += 1
    classMap.set(row.className, current)
  }

  const classAverages = Array.from(classMap.entries())
    .map(([name, x]) => ({ className: name, avgProgress: Math.round((x.sum / x.count) * 10) / 10, students: x.count }))
    .sort((a, b) => b.avgProgress - a.avgProgress)

  return {
    success: true,
    classAverages,
    studentRows,
  }
}
