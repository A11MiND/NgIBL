'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSimulation, refineSimulation, healSimulation, generateDescription, summarizeHistory } from '@/lib/ai-simulation'
import { AIProvider, generateContent } from '@/lib/ai'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { resolveProviderRuntime } from '@/lib/provider-runtime'

type ProviderUser = {
  preferredProvider?: string | null
  defaultModel?: string | null
  deepseekApiKey?: string | null
  qwenApiKey?: string | null
  geminiApiKey?: string | null
  ollamaBaseUrl?: string | null
  [key: string]: unknown
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function toOptionalJson(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}

/**
 * Resolve the user's preferred AI provider, API key, model, and function-specific override.
 */
async function resolveProvider(
  user: ProviderUser,
  functionField?: string,
  explicitModel?: string
): Promise<{ apiKey: string; provider: AIProvider; ollamaBaseUrl?: string; model?: string; baseUrl?: string }> {
  const runtime = resolveProviderRuntime({ user, functionField, explicitModel })
  return {
    apiKey: runtime.apiKey,
    provider: runtime.provider,
    ollamaBaseUrl: runtime.ollamaBaseUrl,
    model: runtime.model,
    baseUrl: runtime.baseUrl,
  }
}

export async function generateSimulationAction(
  prompt: string,
  subject: string,
  type: 'REACT',
  images?: string[],
  modelOverride?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    let resolved: { apiKey: string; provider: AIProvider; ollamaBaseUrl?: string; model?: string; baseUrl?: string }
    let model: string | undefined
    if (images && images.length > 0) {
      const qwenRuntime = resolveProviderRuntime({ user, explicitModel: 'qwen3-vl-plus' })
      if (!qwenRuntime.apiKey && qwenRuntime.provider !== 'ollama') {
        return { success: false, error: 'Image upload requires a Qwen API key. Please configure it in Settings.' }
      }
      resolved = {
        apiKey: qwenRuntime.apiKey,
        provider: qwenRuntime.provider,
        ollamaBaseUrl: qwenRuntime.ollamaBaseUrl,
        model: qwenRuntime.model,
        baseUrl: qwenRuntime.baseUrl,
      }
      model = qwenRuntime.model || 'qwen3-vl-plus'
    } else {
      resolved = await resolveProvider(user, 'simulationModel', modelOverride)
      model = resolved.model
    }

    const normalizedSubject = subject.trim()
    const subjectAwarePrompt = normalizedSubject
      ? `Subject: ${normalizedSubject}\n\nTask:\n${prompt}`
      : prompt

    const result = await generateSimulation(subjectAwarePrompt, type, resolved.apiKey, {
      provider: resolved.provider,
      ollamaBaseUrl: resolved.ollamaBaseUrl,
      baseUrl: resolved.baseUrl,
      model,
      images,
      temperature: 0.2,
    })

    if (!result.success || !result.code) {
      return { success: false, error: result.error || 'Generation failed' }
    }

    return {
      success: true,
      code: result.code,
      variables: null,
      type,
    }
  } catch (error: unknown) {
    logger.error({ error }, 'Generate simulation action error')
    return { success: false, error: getErrorMessage(error, 'Failed to generate simulation') }
  }
}

const HISTORY_WINDOW = 6
const CHECKPOINT_HISTORY_LIMIT = 80

export async function persistCheckpointAction(
  simulationId: string,
  checkpoint: { code: string; type: 'REACT'; reason: string; timestamp: number }
): Promise<{ success: boolean; entry?: Record<string, unknown>; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const simulation = await prisma.simulation.findFirst({
      where: {
        id: simulationId,
        userId: user.id,
      },
      select: {
        versionHistory: true,
      },
    })

    if (!simulation) {
      return { success: false, error: 'Simulation not found' }
    }

    const historyArray = Array.isArray(simulation.versionHistory)
      ? (simulation.versionHistory as Array<Record<string, unknown>>)
      : []

    const maxVersion = historyArray.reduce((max, item) => {
      const rawVersion = item?.version
      const version = typeof rawVersion === 'number' ? rawVersion : 0
      return Math.max(max, version)
    }, 0)

    const entry: Record<string, unknown> = {
      version: maxVersion + 1,
      kind: 'checkpoint',
      code: checkpoint.code,
      type: checkpoint.type,
      timestamp: checkpoint.timestamp,
    }

    const nextHistory = [...historyArray, entry].slice(-CHECKPOINT_HISTORY_LIMIT)

    await prisma.simulation.update({
      where: { id: simulationId },
        data: { versionHistory: nextHistory as Prisma.InputJsonValue },
    })

    return { success: true, entry }
  } catch (error: unknown) {
    logger.error({ error, simulationId }, 'Persist checkpoint action error')
    return { success: false, error: getErrorMessage(error, 'Failed to persist checkpoint') }
  }
}

export async function refineSimulationAction(
  currentCode: string,
  instruction: string,
  type: 'REACT',
  images?: string[],
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  historySummary?: string,
  modelOverride?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // If images provided, force vision model
    let resolved: { apiKey: string; provider: AIProvider; ollamaBaseUrl?: string; model?: string; baseUrl?: string }
    let model: string | undefined
    if (images && images.length > 0) {
      const qwenRuntime = resolveProviderRuntime({ user, explicitModel: 'qwen3-vl-plus' })
      if (!qwenRuntime.apiKey && qwenRuntime.provider !== 'ollama') {
        return { success: false, error: 'Image upload requires a Qwen API key. Please configure it in Settings.' }
      }
      resolved = {
        apiKey: qwenRuntime.apiKey,
        provider: qwenRuntime.provider,
        ollamaBaseUrl: qwenRuntime.ollamaBaseUrl,
        model: qwenRuntime.model,
        baseUrl: qwenRuntime.baseUrl,
      }
      model = qwenRuntime.model || 'qwen3-vl-plus'
    } else {
      resolved = await resolveProvider(user, 'simulationModel', modelOverride)
      model = resolved.model
    }

    let activeSummary = historySummary
    let activeHistory = history || []

    if (activeHistory.length > HISTORY_WINDOW) {
      const overflow = activeHistory.slice(0, activeHistory.length - HISTORY_WINDOW)
      const windowSlice = activeHistory.slice(activeHistory.length - HISTORY_WINDOW)
      try {
        const newSummary = await summarizeHistory(overflow, resolved.apiKey, {
          provider: resolved.provider,
          model,
          ollamaBaseUrl: resolved.ollamaBaseUrl,
          baseUrl: resolved.baseUrl,
        })
        activeSummary = activeSummary ? `${activeSummary} ${newSummary}` : newSummary
        activeHistory = windowSlice
      } catch {
        activeHistory = windowSlice
      }
    }

    const result = await refineSimulation(currentCode, instruction, type, resolved.apiKey, {
      provider: resolved.provider,
      ollamaBaseUrl: resolved.ollamaBaseUrl,
      baseUrl: resolved.baseUrl,
      model,
      images,
      temperature: 0.2,
      history: activeHistory,
      historySummary: activeSummary,
    })

    if (!result.success || !result.code) {
      return { success: false, error: result.error || 'Refinement failed' }
    }

    return {
      success: true,
      code: result.code,
      variables: null,
      historySummary: activeSummary,
    }
  } catch (error: unknown) {
    logger.error({ error }, 'Refine simulation action error')
    return { success: false, error: getErrorMessage(error, 'Failed to refine simulation') }
  }
}

export async function healSimulationAction(
  code: string,
  error: string,
  type: 'REACT',
  modelOverride?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const runtime = await resolveProvider(user, 'simulationModel', modelOverride)

    const result = await healSimulation(code, error, type, runtime.apiKey, {
      provider: runtime.provider,
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      temperature: 0.15,
    })

    return result
  } catch (error: unknown) {
    logger.error({ error }, 'Heal simulation action error')
    return { success: false, error: getErrorMessage(error, 'Failed to heal simulation') }
  }
}

export async function saveSimulationAction(data: {
  title: string
  description?: string
  subject: string
  type: 'REACT'
  reactCode?: string
  variables?: unknown
  isPublic?: boolean
  simulationId?: string // For updates
  versionHistory?: unknown
  chatHistory?: unknown
}) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const simulationData = {
      title: data.title,
      description: data.description || null,
      subject: data.subject,
      type: data.type,
      reactCode: data.reactCode || null,
      geogebraFile: null,
      geogebraMaterialId: null,
      geogebraCommands: toOptionalJson(null),
      geogebraSettings: toOptionalJson(null),
      variables: toOptionalJson(data.variables),
      isPublic: data.isPublic || false,
      versionHistory: toOptionalJson(data.versionHistory),
      chatHistory: toOptionalJson(data.chatHistory),
      userId: user.id
    }

    let simulation
    if (data.simulationId) {
      const ownedSimulation = await prisma.simulation.findFirst({
        where: {
          id: data.simulationId,
          userId: user.id,
        },
        select: { id: true },
      })

      if (!ownedSimulation) {
        return { success: false, error: 'Simulation not found or unauthorized' }
      }

      simulation = await prisma.simulation.update({
        where: { id: data.simulationId },
        data: simulationData
      })
    } else {
      simulation = await prisma.simulation.create({
        data: simulationData
      })
    }

    revalidatePath('/library')
    revalidatePath('/community')

    return {
      success: true,
      simulation
    }
  } catch (error: unknown) {
    logger.error({ error }, 'Save simulation action error')
    return { success: false, error: getErrorMessage(error, 'Failed to save simulation') }
  }
}

export async function generateDescriptionAction(
  code: string,
  subject: string
): Promise<{ success: boolean; description?: string; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return { success: false, error: 'User not found' }

    const runtime = await resolveProvider(user, 'simulationModel')
    return await generateDescription(code, subject, runtime.apiKey, {
      provider: runtime.provider,
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      baseUrl: runtime.baseUrl,
      model: runtime.model,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Generate description action error')
    return { success: false, error: getErrorMessage(error, 'Failed to generate description') }
  }
}

function looksLikeChinese(input: string): boolean {
  return /[\u3400-\u9FFF]/.test(input)
}

export async function rewritePromptAction(
  prompt: string,
  subject: string
): Promise<{ success: boolean; rewrittenPrompt?: string; error?: string }> {
  try {
    const normalized = prompt.trim()
    if (!normalized) return { success: false, error: 'Prompt is empty' }

    const session = await auth()
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return { success: false, error: 'User not found' }

    const runtime = await resolveProvider(user, 'simulationModel')
    const chinese = looksLikeChinese(normalized)

    const systemPrompt = chinese
      ? '你是一个教学仿真提示词优化助手。请把用户输入改写成更清晰、可执行、分步骤的仿真生成提示词。保持中文输出，不要改变原始教学目标；补充必要约束（交互控件、初始状态、成功标准、避免无关复杂度）。只输出改写后的提示词正文。'
      : 'You are a simulation prompt optimization assistant. Rewrite the user input into a clearer, execution-ready, step-by-step prompt for educational simulation generation. Keep output in English, preserve the original teaching objective, and add practical constraints (controls, initial state, success criteria, avoid unnecessary complexity). Output only the rewritten prompt body.'

    const rewritten = await generateContent('', runtime.apiKey, runtime.provider, {
      model: runtime.model,
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      baseUrl: runtime.baseUrl,
      temperature: 0.25,
      timeoutMs: 30000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${chinese ? '学科' : 'Subject'}: ${subject}\n\n${chinese ? '原始提示词' : 'Original prompt'}:\n${normalized}` },
      ],
    })

    const cleaned = rewritten.trim()
    if (!cleaned) return { success: false, error: 'Rewrite returned empty result' }
    return { success: true, rewrittenPrompt: cleaned }
  } catch (error: unknown) {
    logger.error({ error }, 'Rewrite prompt action error')
    return { success: false, error: getErrorMessage(error, 'Failed to rewrite prompt') }
  }
}
