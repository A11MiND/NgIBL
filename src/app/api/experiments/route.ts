import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { withApiErrorHandling, UnauthorizedError } from "@/lib/error-handler"
import { auditLog } from "@/lib/auth-guards"

export async function POST(request: Request) {
  return withApiErrorHandling('POST /api/experiments', async () => {
    const session = await auth()
    if (!session?.user?.email) throw new UnauthorizedError()

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) throw new UnauthorizedError()

    const body = await request.json()
    const { title, subject, description, slug } = body

    const experiment = await prisma.experiment.create({
      data: { title, subject, description, slug, userId: user.id },
    })

    auditLog({ userId: user.id, action: 'CREATE', entity: 'Experiment', entityId: experiment.id })

    return NextResponse.json(experiment)
  })
}
