"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { generateContent, AIProvider } from "@/lib/ai"
import { providerRuntimeNeedsApiKey, resolveProviderRuntime } from "@/lib/provider-runtime"

export async function testConnectionAction(model: string) {
  const session = await auth()
  if (!session?.user?.email) {
    throw new Error("Unauthorized")
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { geminiApiKey: true, deepseekApiKey: true, qwenApiKey: true, ollamaBaseUrl: true, modelProviders: true, preferredProvider: true, defaultModel: true }
  })

  if (!user) throw new Error("User not found")

  // Determine provider and key
  const runtime = resolveProviderRuntime({ user, explicitModel: model })
  const provider: AIProvider = runtime.provider
  const effectiveApiKey = runtime.apiKey
  const ollamaBaseUrl = runtime.ollamaBaseUrl
  const baseUrl = runtime.baseUrl

  if (!effectiveApiKey && providerRuntimeNeedsApiKey(runtime)) {
    throw new Error("No API key found for the selected model. Please configure it in your user settings.")
  }

  try {
    const response = await generateContent(
      "Hello, this is a test connection. Reply with 'Connection successful!'",
      effectiveApiKey || '',
      provider,
      { model, ollamaBaseUrl, baseUrl }
    )
    return { success: true, message: response }
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Connection test failed" }
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
      modelProviders: true,
    },
  })
  if (!user) throw new Error("User not found")

  const runtime = await resolveProviderRuntime({ user, functionField: 'analysisModel' })
  const { provider, apiKey, model, ollamaBaseUrl, baseUrl } = runtime

  if (!apiKey && providerRuntimeNeedsApiKey(runtime)) {
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
    const response = await generateContent(prompt, apiKey, provider, { model, ollamaBaseUrl, baseUrl })

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
    const validTypes = ["SHORT", "LONG", "MCQ", "FILL_IN"] as const
    const cleaned = questions.map((q: Record<string, unknown>) => {
      const rawType = typeof q.type === "string" ? q.type : ""
      const type = validTypes.includes(rawType as (typeof validTypes)[number]) ? rawType : "SHORT"
      return {
        type,
        question: String(q.question || ""),
        options: type === "MCQ" && Array.isArray(q.options) ? q.options.map(String) : null,
      }
    }).filter((q: { question: string }) => q.question.length > 0)

    return { success: true, questions: cleaned }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Generation failed"
    return { success: false, error: message.substring(0, 200) || "Generation failed" }
  }
}