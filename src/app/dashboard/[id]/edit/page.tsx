import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import ExperimentEditor from "./experiment-editor"
import { auth } from "@/auth"
import { getDictionary } from "@/lib/get-dictionary"

export default async function EditExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) redirect("/login")

  const { id } = await params
  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' }
      },
      simulation: true // Include the simulation if already selected
    }
  })

  if (!experiment) {
    notFound()
  }

  if (experiment.userId !== user.id) {
    redirect("/dashboard")
  }

  // Fetch user's simulations for the selector
  const mySimulations = await prisma.simulation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' }
  })

  // Fetch public simulations for community selector
  const communitySimulations = await prisma.simulation.findMany({
    where: { 
      isPublic: true,
      userId: { not: user.id } // Exclude user's own public sims
    },
    orderBy: { views: 'desc' },
    take: 50 // Limit to top 50 most viewed
  })

  const dict = await getDictionary()

  return (
    <ExperimentEditor 
      experiment={experiment} 
      mySimulations={mySimulations}
      communitySimulations={communitySimulations}
      dict={dict} 
    />
  )
}
