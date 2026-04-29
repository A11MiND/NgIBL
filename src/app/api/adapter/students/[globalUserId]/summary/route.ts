import { NextResponse } from 'next/server'
import { Platform, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdapterToken } from '@/lib/adapter-auth'

export async function GET(
  request: Request,
  context: { params: Promise<{ globalUserId: string }> }
) {
  const denied = requireAdapterToken(request)
  if (denied) return denied

  const { globalUserId } = await context.params
  const mappings = await prisma.platformUserMapping.findMany({
    where: { globalUserId, platform: Platform.IBL },
    include: { user: true },
  })

  const userIds = mappings.map((item) => item.userId).filter(Boolean) as string[]
  const localIds = mappings.map((item) => item.localUserId)
  const submissionClauses: Prisma.StudentSubmissionWhereInput[] = []
  if (userIds.length) submissionClauses.push({ userId: { in: userIds } })
  if (localIds.length) submissionClauses.push({ studentId: { in: localIds } })
  const submissionWhere: Prisma.StudentSubmissionWhereInput = submissionClauses.length
    ? { OR: submissionClauses }
    : { id: '__none__' }

  const submissions = await prisma.studentSubmission.findMany({
    where: submissionWhere,
    orderBy: { submittedAt: 'desc' },
    take: 20,
  })

  const progress = await prisma.studentProgressSnapshot.findMany({
    where: {
      studentId: { in: localIds },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const avgProgress = progress.length
    ? progress.reduce((sum, item) => sum + item.progressScore, 0) / progress.length
    : null

  return NextResponse.json({
    global_user_id: globalUserId,
    platform: 'ibl',
    mappings: mappings.map((item) => ({
      local_user_id: item.localUserId,
      user_id: item.userId,
      email: item.user?.email,
      name: item.user?.name,
      role: item.user?.role,
    })),
    summary: {
      submission_count: submissions.length,
      latest_submission_at: submissions[0]?.submittedAt?.toISOString() || null,
      average_progress_score: avgProgress,
    },
    recent_submissions: submissions.map((item) => ({
      id: item.id,
      experiment_id: item.experimentId,
      student_name: item.studentName,
      class_name: item.class,
      submitted_at: item.submittedAt.toISOString(),
    })),
    recent_progress: progress.map((item) => ({
      experiment_id: item.experimentId,
      student_id: item.studentId,
      student_name: item.studentName,
      class_name: item.className,
      progress_score: item.progressScore,
      strengths: item.strengths,
      weaknesses: item.weaknesses,
      metrics: item.metrics,
      created_at: item.createdAt.toISOString(),
    })),
  })
}
