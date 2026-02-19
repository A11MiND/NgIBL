'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function deleteSimulation(id: string) {
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

    // Verify ownership
    const simulation = await prisma.simulation.findUnique({
      where: { id }
    })

    if (!simulation || simulation.userId !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    await prisma.simulation.delete({
      where: { id }
    })

    revalidatePath('/library')
    revalidatePath('/sandbox')
    return { success: true }
  } catch (error: any) {
    console.error('Delete simulation error:', error)
    return { success: false, error: error.message }
  }
}

export async function duplicateSimulation(id: string) {
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

    if (!original) {
      return { success: false, error: 'Simulation not found' }
    }

    // Create duplicate
    const duplicate = await prisma.simulation.create({
      data: {
        title: `${original.title} (Copy)`,
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
        isPublic: false, // Copies are private by default
        userId: user.id
      }
    })

    revalidatePath('/library')
    revalidatePath('/sandbox')
    return { success: true, simulation: duplicate }
  } catch (error: any) {
    console.error('Duplicate simulation error:', error)
    return { success: false, error: error.message }
  }
}

export async function togglePublicSimulation(id: string) {
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

    const simulation = await prisma.simulation.findUnique({
      where: { id }
    })

    if (!simulation || simulation.userId !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const updated = await prisma.simulation.update({
      where: { id },
      data: { isPublic: !simulation.isPublic }
    })

    revalidatePath('/library')
    revalidatePath('/sandbox')
    revalidatePath('/community')
    
    return { success: true, isPublic: updated.isPublic }
  } catch (error: any) {
    console.error('Toggle public error:', error)
    return { success: false, error: error.message }
  }
}
