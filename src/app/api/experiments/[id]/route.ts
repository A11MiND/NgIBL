import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    // Extract fields to update
    const { title, description, aiContext, simulationId, isPublished, questions, aiModel, systemPrompt, temperature, allowImageUpload } = body

    // Transaction to handle experiment update and questions sync
    const experiment = await prisma.$transaction(async (tx) => {
      // 1. Update basic info
      const updatedExperiment = await tx.experiment.update({
        where: { id },
        data: {
          title,
          description,
          aiContext,
          aiModel,
          systemPrompt,
          temperature: parseFloat(temperature),
          simulationId,
          isPublished,
          ...(allowImageUpload !== undefined && { allowImageUpload }),
        },
      })

      // 2. Handle questions if provided
      if (questions) {
        // Delete existing questions not in the new list (if any logic needed, or just replace all)
        // For simplicity, we can delete all and recreate, or upsert.
        // Let's try to be smart: delete those not in the list, upsert those that are.
        
        const questionIds = questions.filter((q: any) => q.id).map((q: any) => q.id)
        
        await tx.worksheetQuestion.deleteMany({
          where: {
            experimentId: id,
            id: { notIn: questionIds }
          }
        })

        for (const q of questions) {
          if (q.id) {
            await tx.worksheetQuestion.update({
              where: { id: q.id },
              data: {
                type: q.type,
                question: q.question,
                options: q.options,
                order: q.order
              }
            })
          } else {
            await tx.worksheetQuestion.create({
              data: {
                experimentId: id,
                type: q.type,
                question: q.question,
                options: q.options,
                order: q.order
              }
            })
          }
        }
      }

      return updatedExperiment
    })

    return NextResponse.json(experiment)
  } catch (error) {
    console.error("Error updating experiment:", error)
    return NextResponse.json(
      { error: "Failed to update experiment" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.experiment.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting experiment:", error)
    return NextResponse.json(
      { error: "Failed to delete experiment" },
      { status: 500 }
    )
  }
}
