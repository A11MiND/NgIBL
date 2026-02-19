"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { generateContent, AIProvider } from "@/lib/ai"
import bcrypt from "bcryptjs"

export async function updateApiKeysAction(data: {
  geminiKey?: string
  deepseekKey?: string
  qwenKey?: string
  ollamaUrl?: string
  preferredProvider?: string
  defaultModel?: string
  simulationModel?: string
  chatbotModel?: string
  analysisModel?: string
}) {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const update: any = {}
  if (data.geminiKey) update.geminiApiKey = data.geminiKey
  if (data.deepseekKey) update.deepseekApiKey = data.deepseekKey
  if (data.qwenKey) update.qwenApiKey = data.qwenKey
  if (data.ollamaUrl) update.ollamaBaseUrl = data.ollamaUrl
  if (data.preferredProvider) update.preferredProvider = data.preferredProvider
  if (data.defaultModel !== undefined) update.defaultModel = data.defaultModel
  if (data.simulationModel !== undefined) update.simulationModel = data.simulationModel || null
  if (data.chatbotModel !== undefined) update.chatbotModel = data.chatbotModel || null
  if (data.analysisModel !== undefined) update.analysisModel = data.analysisModel || null

  if (Object.keys(update).length === 0) return

  await prisma.user.update({
    where: { email: session.user.email },
    data: update,
  })

  revalidatePath("/dashboard/settings")
}

export async function testProviderAction(provider: string): Promise<{ success: boolean; message: string }> {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      geminiApiKey: true,
      deepseekApiKey: true,
      qwenApiKey: true,
      ollamaBaseUrl: true,
    },
  })
  if (!user) throw new Error("User not found")

  let apiKey: string | undefined
  let ollamaBaseUrl: string | undefined

  switch (provider) {
    case "deepseek":
      apiKey = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || undefined
      break
    case "qwen":
      apiKey = process.env.QWEN_API_KEY || user.qwenApiKey || undefined
      break
    case "gemini":
      apiKey = process.env.GEMINI_API_KEY || user.geminiApiKey || undefined
      break
    case "ollama":
      ollamaBaseUrl = user.ollamaBaseUrl || "http://localhost:11434"
      apiKey = "ollama" // placeholder; ollama doesn't need auth
      break
    default:
      return { success: false, message: `Unknown provider: ${provider}` }
  }

  if (!apiKey && provider !== "ollama") {
    return { success: false, message: "No API key configured for this provider." }
  }

  try {
    const response = await generateContent(
      "Reply with exactly: Connection successful!",
      apiKey || "",
      provider as AIProvider,
      { ollamaBaseUrl }
    )
    return { success: true, message: response.substring(0, 100) }
  } catch (error: any) {
    return { success: false, message: error.message?.substring(0, 200) || "Connection failed" }
  }
}

export async function fetchOllamaModelsAction(baseUrl: string): Promise<{ success: boolean; models?: string[] }> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { success: false }
    const data = await res.json()
    const models = (data.models || []).map((m: any) => m.name as string)
    return { success: true, models }
  } catch {
    return { success: false }
  }
}

export async function changePasswordAction(data: {
  currentPassword: string
  newPassword: string
}): Promise<{ success: boolean; message: string }> {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  if (!data.currentPassword || !data.newPassword) {
    return { success: false, message: "Please fill in all fields." }
  }

  if (data.newPassword.length < 6) {
    return { success: false, message: "New password must be at least 6 characters." }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { password: true },
  })
  if (!user) return { success: false, message: "User not found." }

  const isValid = await bcrypt.compare(data.currentPassword, user.password)
  if (!isValid) {
    return { success: false, message: "Current password is incorrect." }
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, 10)
  await prisma.user.update({
    where: { email: session.user.email },
    data: { password: hashedPassword },
  })

  return { success: true, message: "Password changed successfully!" }
}

