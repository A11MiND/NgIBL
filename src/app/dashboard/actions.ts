'use server'

import { prisma } from "@/lib/prisma"
import { requireExperimentOwner } from "@/lib/auth-guards"
import { revalidatePath } from "next/cache"

export async function deleteExperiment(id: string) {
  await requireExperimentOwner(id)

  await prisma.experiment.delete({
    where: { id }
  })

  revalidatePath("/dashboard")
}
