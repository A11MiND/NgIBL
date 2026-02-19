'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function deleteExperiment(id: string) {
  const session = await auth()
  if (!session?.user?.email) {
    throw new Error("Unauthorized")
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    throw new Error("Unauthorized")
  }

  // Verify ownership
  const experiment = await prisma.experiment.findUnique({
    where: { id },
    select: { userId: true }
  })

  if (!experiment) {
    throw new Error("Experiment not found")
  }

  if (experiment.userId !== user.id) {
    throw new Error("Unauthorized")
  }

  await prisma.experiment.delete({
    where: { id }
  })

  revalidatePath("/dashboard")
}
