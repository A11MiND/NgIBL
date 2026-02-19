"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function deleteSimulationAction(simulationId: string) {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) throw new Error("User not found")

  // Verify ownership
  const sim = await prisma.simulation.findUnique({ where: { id: simulationId } })
  if (!sim || sim.userId !== user.id) throw new Error("Not found")

  await prisma.simulation.delete({ where: { id: simulationId } })
  revalidatePath("/sandbox")
  revalidatePath("/library")
}
