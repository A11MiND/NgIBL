import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import StudentView from "./student-view"

export default async function ExperimentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const experiment = await prisma.experiment.findUnique({
    where: { slug },
    include: {
      questions: {
        orderBy: { order: 'asc' }
      },
      simulation: true
    }
  })

  if (!experiment) {
    notFound()
  }

  return <StudentView experiment={experiment} />
}
