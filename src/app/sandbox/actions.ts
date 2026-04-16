'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSimulation, refineSimulation, healSimulation, generateDescription, summarizeHistory } from '@/lib/ai-simulation'
import { AIProvider, inferProviderFromModel } from '@/lib/ai'
import { revalidatePath } from 'next/cache'

/**
 * Resolve the user's preferred AI provider, API key, model, and function-specific override.
 */
async function resolveProvider(user: any, functionField?: string): Promise<{ apiKey: string; provider: AIProvider; ollamaBaseUrl?: string; model?: string }> {
  // Resolve model first; infer provider from model ID if set
  const model = (functionField && user[functionField]) || user.defaultModel || undefined
  const inferredProvider = model ? inferProviderFromModel(model) : null
  const preferred = inferredProvider || user.preferredProvider || 'deepseek'

  const resolvers: Record<string, () => { apiKey: string; provider: AIProvider; ollamaBaseUrl?: string } | null> = {
    deepseek: () => {
      const key = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey
      return key ? { apiKey: key, provider: 'deepseek' } : null
    },
    qwen: () => {
      const key = process.env.QWEN_API_KEY || user.qwenApiKey
      return key ? { apiKey: key, provider: 'qwen' } : null
    },
    gemini: () => {
      const key = process.env.GEMINI_API_KEY || user.geminiApiKey
      return key ? { apiKey: key, provider: 'gemini' } : null
    },
    ollama: () => {
      return { apiKey: '', provider: 'ollama', ollamaBaseUrl: user.ollamaBaseUrl || 'http://localhost:11434' }
    },
  }

  // Try preferred first, then fallback
  const result = resolvers[preferred]?.()
  if (result) {
    return { ...result, model }
  }

  // Fallback: try each provider
  for (const key of ['deepseek', 'qwen', 'gemini', 'ollama']) {
    const r = resolvers[key]?.()
    if (r) {
      return { ...r, model }
    }
  }

  throw new Error('No AI provider configured. Please add an API key in Settings.')
}

export async function generateSimulationAction(
  prompt: string,
  subject: string,
  type: 'REACT' | 'GEOGEBRA_API',
  images?: string[]
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

    // If images provided, force vision model (qwen3-vl-plus)
    let resolved: { apiKey: string; provider: AIProvider; ollamaBaseUrl?: string; model?: string }
    let model: string | undefined
    if (images && images.length > 0) {
      const qwenKey = user.qwenApiKey
      if (!qwenKey) {
        return { success: false, error: 'Image upload requires a Qwen API key. Please configure it in Settings.' }
      }
      resolved = { apiKey: qwenKey, provider: 'qwen' }
      model = 'qwen3-vl-plus'
    } else {
      resolved = await resolveProvider(user, 'simulationModel')
      model = resolved.model
    }

    // Generate simulation
    const result = await generateSimulation(prompt, type, resolved.apiKey, {
      provider: resolved.provider,
      ollamaBaseUrl: resolved.ollamaBaseUrl,
      model,
      images,
      temperature: 0.25,
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
  } catch (error: any) {
    console.error('Generate simulation action error:', error)
    return { success: false, error: error.message || 'Failed to generate simulation' }
  }
}

const HISTORY_WINDOW = 6
const CHECKPOINT_HISTORY_LIMIT = 80

export async function persistCheckpointAction(
  simulationId: string,
  checkpoint: { code: string; type: 'REACT' | 'GEOGEBRA_API'; reason: string; timestamp: number }
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
      prompt: `[checkpoint] ${checkpoint.reason}`,
    }

    const nextHistory = [...historyArray, entry].slice(-CHECKPOINT_HISTORY_LIMIT)

    await prisma.simulation.update({
      where: { id: simulationId },
      data: { versionHistory: nextHistory as any },
    })

    return { success: true, entry }
  } catch (error: any) {
    console.error('Persist checkpoint action error:', error)
    return { success: false, error: error?.message || 'Failed to persist checkpoint' }
  }
}

export async function refineSimulationAction(
  currentCode: string,
  instruction: string,
  type: 'REACT' | 'GEOGEBRA_API',
  images?: string[],
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  historySummary?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    // If images provided, force vision model
    let resolved: { apiKey: string; provider: AIProvider; ollamaBaseUrl?: string; model?: string }
    let model: string | undefined
    if (images && images.length > 0) {
      const qwenKey = user!.qwenApiKey
      if (!qwenKey) {
        return { success: false, error: 'Image upload requires a Qwen API key. Please configure it in Settings.' }
      }
      resolved = { apiKey: qwenKey, provider: 'qwen' }
      model = 'qwen3-vl-plus'
    } else {
      resolved = await resolveProvider(user!, 'simulationModel')
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
  } catch (error: any) {
    console.error('Refine simulation action error:', error)
    return { success: false, error: error.message || 'Failed to refine simulation' }
  }
}

export async function healSimulationAction(
  code: string,
  error: string,
  type: 'REACT' | 'GEOGEBRA_API'
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    const { apiKey, provider, ollamaBaseUrl, model } = await resolveProvider(user!, 'simulationModel')

    const result = await healSimulation(code, error, type, apiKey, {
      provider,
      ollamaBaseUrl,
      model,
      temperature: 0.15,
    })

    return result
  } catch (error: any) {
    console.error('Heal simulation action error:', error)
    return { success: false, error: error.message || 'Failed to heal simulation' }
  }
}

export async function saveSimulationAction(data: {
  title: string
  description?: string
  subject: string
  type: 'REACT' | 'GEOGEBRA_FILE' | 'GEOGEBRA_API'
  reactCode?: string
  geogebraFile?: string
  geogebraMaterialId?: string
  geogebraCommands?: any
  geogebraSettings?: any
  variables?: any
  isPublic?: boolean
  simulationId?: string // For updates
  versionHistory?: any
  chatHistory?: any
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
      geogebraFile: data.geogebraFile || null,
      geogebraMaterialId: data.geogebraMaterialId || null,
      geogebraCommands: data.geogebraCommands || null,
      geogebraSettings: data.geogebraSettings || null,
      variables: data.variables || null,
      isPublic: data.isPublic || false,
      versionHistory: data.versionHistory || null,
      chatHistory: data.chatHistory || null,
      userId: user.id
    }

    let simulation
    if (data.simulationId) {
      // Update existing
      simulation = await prisma.simulation.update({
        where: { id: data.simulationId },
        data: simulationData
      })
    } else {
      // Create new
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
  } catch (error: any) {
    console.error('Save simulation action error:', error)
    return { success: false, error: error.message || 'Failed to save simulation' }
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

    const { apiKey, provider, ollamaBaseUrl, model } = await resolveProvider(user, 'simulationModel')
    return await generateDescription(code, subject, apiKey, { provider, ollamaBaseUrl, model })
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
