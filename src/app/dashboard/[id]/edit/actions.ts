"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { generateContent, AIProvider } from "@/lib/ai"

/**
 * Resolve the AI provider, key, and model based on user settings.
 * If functionModel is set, use that; otherwise fall back to defaultModel.
 */
async function resolveAI(user: any, functionField?: string) {
  const provider: AIProvider = user.preferredProvider || 'deepseek'
  let apiKey: string | undefined
  let ollamaBaseUrl: string | undefined

  switch (provider) {
    case 'deepseek':
      apiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || undefined
      break
    case 'qwen':
      apiKey = process.env.QWEN_API_KEY || user.qwenApiKey || undefined
      break
    case 'gemini':
      apiKey = process.env.GEMINI_API_KEY || user.geminiApiKey || undefined
      break
    case 'ollama':
      ollamaBaseUrl = user.ollamaBaseUrl || 'http://localhost:11434'
      apiKey = ''
      break
  }

  // Determine model: function-specific override > default model > provider default
  const model = (functionField && user[functionField]) || user.defaultModel || undefined

  return { provider, apiKey: apiKey || '', model, ollamaBaseUrl }
}

export async function testConnectionAction(model: string, apiKey?: string) {
  const session = await auth()
  if (!session?.user?.email) {
    throw new Error("Unauthorized")
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { geminiApiKey: true, deepseekApiKey: true, qwenApiKey: true, ollamaBaseUrl: true }
  })

  if (!user) throw new Error("User not found")

  // Determine provider and key
  let provider: AIProvider = 'deepseek'
  if (model.toLowerCase().includes('gemini')) {
    provider = 'gemini'
  } else if (model.toLowerCase().includes('deepseek')) {
    provider = 'deepseek'
  } else if (model.toLowerCase().includes('qwen')) {
    provider = 'qwen'
  } else if (user.ollamaBaseUrl) {
    // Unknown model name + Ollama configured → likely an Ollama model
    provider = 'ollama'
  } else {
    // Fallback based on available keys
    provider = user.deepseekApiKey ? 'deepseek' : user.qwenApiKey ? 'qwen' : 'gemini'
  }

  let effectiveApiKey: string | undefined
  let ollamaBaseUrl: string | undefined

  switch (provider) {
    case 'deepseek':
      effectiveApiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || undefined
      break
    case 'qwen':
      effectiveApiKey = user.qwenApiKey || undefined
      break
    case 'gemini':
      effectiveApiKey = process.env.GEMINI_API_KEY || user.geminiApiKey || undefined
      break
    case 'ollama':
      ollamaBaseUrl = user.ollamaBaseUrl || 'http://localhost:11434'
      effectiveApiKey = ''
      break
  }

  if (!effectiveApiKey && provider !== 'ollama') {
    throw new Error("No API key found for the selected model. Please configure it in your user settings.")
  }

  try {
    const response = await generateContent(
      "Hello, this is a test connection. Reply with 'Connection successful!'",
      effectiveApiKey || '',
      provider,
      { model, ollamaBaseUrl }
    )
    return { success: true, message: response }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function generateWorksheetQuestionsAction(data: {
  experimentId: string
  subject: string
  title: string
  description: string
  simulationCode?: string
  count?: number
}): Promise<{ success: boolean; questions?: { type: string; question: string; options: string[] | null }[]; error?: string }> {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      preferredProvider: true,
      defaultModel: true,
      analysisModel: true,
      deepseekApiKey: true,
      qwenApiKey: true,
      geminiApiKey: true,
      ollamaBaseUrl: true,
    },
  })
  if (!user) throw new Error("User not found")

  const { provider, apiKey, model, ollamaBaseUrl } = await resolveAI(user, 'analysisModel')

  if (!apiKey && provider !== 'ollama') {
    return { success: false, error: "No API key configured. Go to Settings to add one." }
  }

  const count = data.count || 5
  const simContext = data.simulationCode
    ? `\n\nThe experiment includes an interactive simulation. Here is the simulation code for context:\n\`\`\`\n${data.simulationCode.substring(0, 2000)}\n\`\`\``
    : ""

  const prompt = `You are a science education expert. Generate ${count} worksheet questions for students based on this experiment.

Experiment Title: ${data.title}
Subject: ${data.subject}
Description: ${data.description || "No description provided"}${simContext}

Generate a mix of question types:
- SHORT: Short answer (1-2 sentences)
- LONG: Long answer / explanation
- MCQ: Multiple choice (provide 4 options)
- FILL_IN: Fill in the blank

Return ONLY a JSON array of objects, each with:
- "type": "SHORT" | "LONG" | "MCQ" | "FILL_IN"
- "question": the question text
- "options": array of 4 strings for MCQ, or null for other types

Example:
[
  {"type": "SHORT", "question": "What happens to the velocity after collision?", "options": null},
  {"type": "MCQ", "question": "Which law governs elastic collisions?", "options": ["Newton's First Law", "Conservation of Momentum", "Ohm's Law", "Boyle's Law"]}
]

Generate exactly ${count} questions. Return ONLY the JSON array, no other text.`

  try {
    const response = await generateContent(prompt, apiKey, provider, { model, ollamaBaseUrl })

    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return { success: false, error: "AI returned invalid format. Please try again." }
    }

    const questions = JSON.parse(jsonMatch[0])
    if (!Array.isArray(questions)) {
      return { success: false, error: "AI returned invalid format." }
    }

    // Validate and clean
    const cleaned = questions.map((q: any) => ({
      type: ["SHORT", "LONG", "MCQ", "FILL_IN"].includes(q.type) ? q.type : "SHORT",
      question: String(q.question || ""),
      options: q.type === "MCQ" && Array.isArray(q.options) ? q.options.map(String) : null,
    })).filter((q: any) => q.question.length > 0)

    return { success: true, questions: cleaned }
  } catch (error: any) {
    return { success: false, error: error.message?.substring(0, 200) || "Generation failed" }
  }
}