"use server"

import { prisma } from "@/lib/prisma"
import { generateContent, AIProvider } from "@/lib/ai"
import { getRAGContext } from "@/lib/rag"
import { rateLimit } from "@/lib/rate-limit"
import { logAI } from "@/lib/logger"
import { providerRuntimeNeedsApiKey, resolveProviderRuntime } from "@/lib/provider-runtime"

type TutorUser = {
  id: string
  chatbotModel?: string | null
  geminiApiKey?: string | null
  deepseekApiKey?: string | null
  qwenApiKey?: string | null
  ollamaBaseUrl?: string | null
  modelProviders?: unknown
  preferredProvider?: string | null
  defaultModel?: string | null
  [key: string]: unknown
}

export async function chatWithTutor(
  experimentId: string,
  message: string,
  history: { role: string; content: string }[],
  images?: string[]
) {
  const startTime = Date.now()

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: { user: true }
  })

  if (!experiment || !experiment.user) {
    throw new Error("Experiment not found")
  }

  const user = experiment.user as unknown as TutorUser
  const hasImages = images && images.length > 0

  // ─── Rate Limiting ──────────────────────────────────────────────
  const rateLimitResult = await rateLimit(user.id, 'chatbot')
  if (!rateLimitResult.success) {
    return `You're sending messages too quickly. Please wait ${Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)}s before trying again. (${rateLimitResult.remaining} remaining)`
  }

  // Use per-function chatbotModel override > experiment aiModel > default
  const baseModel = String(user.chatbotModel || experiment.aiModel || "deepseek-chat")

  let provider: AIProvider
  let model: string
  let effectiveApiKey: string
  let ollamaBaseUrl: string | undefined
  let baseUrl: string | undefined
  let runtimeNeedsApiKey = true

  try {
    const runtime = resolveProviderRuntime({
      user,
      functionField: 'chatbotModel',
      explicitModel: hasImages ? 'qwen3-vl-plus' : baseModel,
    })

    provider = runtime.provider
    model = runtime.model || (hasImages ? 'qwen3-vl-plus' : baseModel)
    effectiveApiKey = runtime.apiKey
    ollamaBaseUrl = runtime.ollamaBaseUrl
    baseUrl = runtime.baseUrl
    runtimeNeedsApiKey = providerRuntimeNeedsApiKey(runtime)
  } catch {
    return hasImages
      ? "Image recognition requires a Qwen-compatible model provider/API key. Please ask your teacher to configure it in Settings."
      : "I'm sorry, but the AI tutor is not configured for this experiment yet. Please ask your teacher to set up API keys or model providers."
  }

  if (!effectiveApiKey && runtimeNeedsApiKey) {
    if (hasImages) {
      return "Image recognition requires a Qwen-compatible model provider/API key. Please ask your teacher to configure it in Settings."
    }
    return "I'm sorry, but the AI tutor is not configured for this experiment yet. Please ask your teacher to set up API keys or model providers."
  }

  // ─── RAG: Semantic search for relevant context ──────────────────
  const knowledge = await getRAGContext(
    experimentId,
    message,
    experiment.aiContext,
    {
      provider: provider === 'ollama' ? 'ollama' : (user.geminiApiKey ? 'gemini' : undefined),
      apiKey: user.geminiApiKey || effectiveApiKey!,
      ollamaBaseUrl: user.ollamaBaseUrl || undefined,
    }
  )

  const systemInstructions = experiment.systemPrompt || "You are a helpful science tutor. You must only answer questions related to the experiment. Do not help students with their homework directly. Do not reveal answers to the worksheet questions."

  const fullSystemPrompt = hasImages
    ? `${systemInstructions}\n\nContext/Knowledge Base:\n${knowledge}\n\nThe student has attached image(s). Analyze the image content carefully and respond in the context of this experiment.`
    : `${systemInstructions}\n\nContext/Knowledge Base:\n${knowledge}`

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: fullSystemPrompt },
    ...history.map((msg): { role: 'user' | 'assistant'; content: string } => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: message || "Please look at the image(s) I've attached and help me." }
  ]

  try {
    const response = await generateContent("", effectiveApiKey, provider, {
      temperature: experiment.temperature,
      model: model,
      messages: messages,
      images: hasImages ? images : undefined,
      ollamaBaseUrl,
      baseUrl,
    })

    logAI('chatbot', {
      provider,
      model,
      duration: Date.now() - startTime,
    })

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error occurred"
    logAI('chatbot', {
      provider,
      model,
      duration: Date.now() - startTime,
      error: message,
    })
    return `Error: ${message}`
  }
}
