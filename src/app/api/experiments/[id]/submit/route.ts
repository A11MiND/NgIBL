import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { student, answers } = body

    // Create submission
    const submission = await prisma.studentSubmission.create({
      data: {
        experimentId: id,
        studentName: student.name,
        studentId: student.id,
        class: student.class,
        answers: {
          create: Object.entries(answers).map(([questionId, value]) => ({
            questionId,
            value: value as string
          }))
        }
      }
    })

    return NextResponse.json(submission)
  } catch (error) {
    console.error("Error submitting worksheet:", error)
    return NextResponse.json(
      { error: "Failed to submit worksheet" },
      { status: 500 }
    )
  }
}
