import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiErrorHandling } from "@/lib/error-handler"
import { logger } from "@/lib/logger"
import { cacheDelete, CacheKeys } from "@/lib/cache"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling('POST /api/experiments/[id]/submit', async () => {
    const { id } = await params
    const body = await request.json()
    const { student, answers } = body

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

    // Invalidate class analysis cache (new submission changes the data)
    await cacheDelete(CacheKeys.classAnalysis(id))

    logger.info({ experimentId: id, submissionId: submission.id, studentName: student.name }, 'Student submission received')

    return NextResponse.json(submission)
  })
}
