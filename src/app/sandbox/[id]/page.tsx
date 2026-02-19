import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import SandboxStudio from "../sandbox-studio"

export default async function SandboxEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) redirect("/login")

  const { id } = await params
  const simulation = await prisma.simulation.findUnique({
    where: { id },
  })

  if (!simulation) notFound()
  if (simulation.userId !== user.id) redirect("/library")

  // Check if user has any AI key configured
  const hasApiKey = !!(
    process.env.DEEPSEEK_API_KEY ||
    user.deepseekApiKey ||
    user.qwenApiKey ||
    user.ollamaBaseUrl
  )

  return (
    <SandboxStudio
      hasApiKey={hasApiKey}
      initialSimulation={{
        id: simulation.id,
        title: simulation.title,
        description: simulation.description,
        subject: simulation.subject,
        type: simulation.type as 'REACT' | 'GEOGEBRA_API',
        code: simulation.reactCode || (simulation.geogebraCommands ? JSON.stringify(simulation.geogebraCommands) : ''),
        versionHistory: (simulation.versionHistory as any[]) || [],
      }}
    />
  )
}
