import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/get-dictionary"
import SettingsForm from "./settings-form"

function sanitizeModelProviders(raw: unknown): unknown {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>
      return {
        id: typeof row.id === "string" ? row.id : "",
        name: typeof row.name === "string" ? row.name : "",
        category: typeof row.category === "string" ? row.category : "global",
        model: typeof row.model === "string" ? row.model : "",
        models: Array.isArray(row.models) ? row.models.filter((m): m is string => typeof m === "string") : [],
        baseUrl: typeof row.baseUrl === "string" ? row.baseUrl : "",
        enabled: row.enabled !== false,
        credits: typeof row.credits === "number" ? row.credits : undefined,
        hasStoredApiKey: typeof row.apiKey === "string" && row.apiKey.trim().length > 0,
      }
    })
    .filter((row) => row.id && row.name)
}

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      geminiApiKey: true,
      deepseekApiKey: true,
      qwenApiKey: true,
      ollamaBaseUrl: true,
      preferredProvider: true,
      modelProviders: true,
      deepseekCredits: true,
      defaultModel: true,
      simulationModel: true,
      chatbotModel: true,
      analysisModel: true,
    }
  })

  if (!user) redirect("/login")

  const dict = await getDictionary()

  return (
    <SettingsForm
      currentKeys={{
          hasGeminiApiKey: Boolean(user.geminiApiKey?.trim()),
          hasDeepseekApiKey: Boolean(user.deepseekApiKey?.trim()),
          hasQwenApiKey: Boolean(user.qwenApiKey?.trim()),
        ollamaBaseUrl: user.ollamaBaseUrl,
        preferredProvider: user.preferredProvider,
          modelProviders: sanitizeModelProviders(user.modelProviders),
        deepseekCredits: user.deepseekCredits,
        defaultModel: user.defaultModel,
        simulationModel: user.simulationModel,
        chatbotModel: user.chatbotModel,
        analysisModel: user.analysisModel,
      }}
      dict={dict}
    />
  )
}
