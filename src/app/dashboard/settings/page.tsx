import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/get-dictionary"
import SettingsForm from "./settings-form"

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
        geminiApiKey: user.geminiApiKey,
        deepseekApiKey: user.deepseekApiKey,
        qwenApiKey: user.qwenApiKey,
        ollamaBaseUrl: user.ollamaBaseUrl,
        preferredProvider: user.preferredProvider,
        defaultModel: user.defaultModel,
        simulationModel: user.simulationModel,
        chatbotModel: user.chatbotModel,
        analysisModel: user.analysisModel,
      }}
      dict={dict}
    />
  )
}
