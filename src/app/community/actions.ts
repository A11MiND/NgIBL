'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function forkSimulation(id: string) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const original = await prisma.simulation.findUnique({
      where: { id }
    })

    if (!original || !original.isPublic) {
      return { success: false, error: 'Simulation not found or not public' }
    }

    // Create fork
    const fork = await prisma.simulation.create({
      data: {
        title: `${original.title} (Fork)`,
        description: original.description,
        subject: original.subject,
        type: original.type,
        reactCode: original.reactCode,
        geogebraFile: original.geogebraFile,
        geogebraMaterialId: original.geogebraMaterialId,
        geogebraCommands: original.geogebraCommands ?? undefined,
        geogebraSettings: original.geogebraSettings ?? undefined,
        variables: original.variables ?? undefined,
        thumbnail: original.thumbnail,
        isPublic: false, // Forks are private by default
        parentId: original.id,
        userId: user.id
      }
    })

    // Increment fork count on original
    await prisma.simulation.update({
      where: { id: original.id },
      data: { forks: { increment: 1 } }
    })

    revalidatePath('/library')
    revalidatePath('/community')

    return { success: true, forkId: fork.id }
  } catch (error: any) {
    console.error('Fork simulation error:', error)
    return { success: false, error: error.message }
  }
}

export async function incrementViews(id: string) {
  try {
    await prisma.simulation.update({
      where: { id },
      data: { views: { increment: 1 } }
    })
    
    return { success: true }
  } catch (error: any) {
    console.error('Increment views error:', error)
    return { success: false, error: error.message }
  }
}
