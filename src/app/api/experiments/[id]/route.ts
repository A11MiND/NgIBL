import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiErrorHandling } from "@/lib/error-handler"
import { logger } from "@/lib/logger"
import { cacheDelete, CacheKeys } from "@/lib/cache"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling('PATCH /api/experiments/[id]', async () => {
    const { id } = await params
    const body = await request.json()
    const { title, description, aiContext, simulationId, isPublished, questions, aiModel, systemPrompt, temperature, allowImageUpload } = body

    const experiment = await prisma.$transaction(async (tx) => {
      const updatedExperiment = await tx.experiment.update({
        where: { id },
        data: {
          title, description, aiContext, aiModel, systemPrompt,
          temperature: parseFloat(temperature),
          simulationId, isPublished,
          ...(allowImageUpload !== undefined && { allowImageUpload }),
        },
      })

      if (questions) {
        const questionIds = questions.filter((q: any) => q.id).map((q: any) => q.id)
        
        await tx.worksheetQuestion.deleteMany({
          where: { experimentId: id, id: { notIn: questionIds } }
        })

        for (const q of questions) {
          if (q.id) {
            await tx.worksheetQuestion.update({
              where: { id: q.id },
              data: { type: q.type, question: q.question, options: q.options, order: q.order }
            })
          } else {
            await tx.worksheetQuestion.create({
              data: { experimentId: id, type: q.type, question: q.question, options: q.options, order: q.order }
            })
          }
        }
      }

      return updatedExperiment
    })

    // Invalidate analysis cache when experiment is updated
    await cacheDelete(CacheKeys.classAnalysis(id))

    logger.info({ experimentId: id }, 'Experiment updated')
    return NextResponse.json(experiment)
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling('DELETE /api/experiments/[id]', async () => {
    const { id } = await params
    await prisma.experiment.delete({ where: { id } })

    // Invalidate caches
    await cacheDelete(CacheKeys.classAnalysis(id))

    logger.info({ experimentId: id }, 'Experiment deleted')
    return NextResponse.json({ success: true })
  })
}
