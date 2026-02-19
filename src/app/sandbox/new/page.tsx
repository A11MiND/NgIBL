import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import SandboxStudio from "../sandbox-studio"

export default async function NewSandboxPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })
  if (!user) redirect("/login")

  const hasApiKey = !!(
    process.env.DEEPSEEK_API_KEY ||
    user.deepseekApiKey ||
    user.qwenApiKey ||
    user.ollamaBaseUrl ||
    process.env.GEMINI_API_KEY ||
    user.geminiApiKey
  )

  return <SandboxStudio hasApiKey={hasApiKey} />
}
