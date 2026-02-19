"use server"

import { prisma } from "@/lib/prisma"
import { generateContent, AIProvider } from "@/lib/ai"

export async function chatWithTutor(
  experimentId: string,
  message: string,
  history: { role: string; content: string }[],
  images?: string[]
) {
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: { user: true }
  })

  if (!experiment || !experiment.user) {
    throw new Error("Experiment not found")
  }

  const user = experiment.user as any
  const hasImages = images && images.length > 0

  // Use per-function chatbotModel override > experiment aiModel > default
  let baseModel = (user.chatbotModel || experiment.aiModel) as string

  // Determine provider — if images present, force qwen3-vl-plus for vision
  let provider: AIProvider = 'deepseek'
  let model = baseModel

  if (hasImages) {
    // Force vision model
    provider = 'qwen'
    model = 'qwen3-vl-plus'
  } else if (model.toLowerCase().includes('gemini')) {
    provider = 'gemini'
  } else if (model.toLowerCase().includes('qwen')) {
    provider = 'qwen'
  } else if (model.toLowerCase().includes('deepseek')) {
    provider = 'deepseek'
  } else if (model.toLowerCase().includes('ollama') || model.includes(':')) {
    provider = 'ollama'
  }

  // Get API Key based on provider
  let effectiveApiKey: string | null | undefined

  if (provider === 'qwen') {
    effectiveApiKey = user.qwenApiKey
  } else if (provider === 'deepseek') {
    effectiveApiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey
  } else if (provider === 'gemini') {
    effectiveApiKey = process.env.GEMINI_API_KEY || user.geminiApiKey
  } else if (provider === 'ollama') {
    effectiveApiKey = 'ollama' // Ollama doesn't need a key
  }

  // Fallback logic (only when no images — can't fallback vision)
  if (!effectiveApiKey && !hasImages) {
    if (provider === 'deepseek' && user.geminiApiKey) {
      provider = 'gemini'
      effectiveApiKey = process.env.GEMINI_API_KEY || user.geminiApiKey
      model = 'gemini-1.5-flash'
    } else {
      const deepseekKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey
      if (deepseekKey) {
        provider = 'deepseek'
        effectiveApiKey = deepseekKey
        model = 'deepseek-chat'
      }
    }
  }

  if (!effectiveApiKey) {
    if (hasImages) {
      return "Image recognition requires a Qwen API key. Please ask your teacher to configure it in Settings."
    }
    return "I'm sorry, but the AI tutor is not configured for this experiment yet. Please ask your teacher to set up the API keys."
  }

  const knowledge = experiment.aiContext || ""
  const systemInstructions = experiment.systemPrompt || "You are a helpful science tutor. You must only answer questions related to the experiment. Do not help students with their homework directly. Do not reveal answers to the worksheet questions."

  const fullSystemPrompt = hasImages
    ? `${systemInstructions}\n\nContext/Knowledge Base:\n${knowledge}\n\nThe student has attached image(s). Analyze the image content carefully and respond in the context of this experiment.`
    : `${systemInstructions}\n\nContext/Knowledge Base:\n${knowledge}`

  const messages: any[] = [
    { role: 'system', content: fullSystemPrompt },
    ...history.map(msg => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content })),
    { role: 'user', content: message || "Please look at the image(s) I've attached and help me." }
  ]

  try {
    const response = await generateContent("", effectiveApiKey!, provider!, {
      temperature: experiment.temperature,
      model: model,
      messages: messages,
      images: hasImages ? images : undefined,
    })
    return response
  } catch (error: any) {
    console.error("Chat Error:", error)
    return `Error: ${error.message || "Unknown error occurred"}`
  }
}
