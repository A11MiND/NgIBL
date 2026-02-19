import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, subject, description, slug } = body

    const experiment = await prisma.experiment.create({
      data: {
        title,
        subject,
        description,
        slug,
        userId: user.id,
      },
    })

    return NextResponse.json(experiment)
  } catch (error) {
    console.error("Error creating experiment:", error)
    return NextResponse.json(
      { error: "Failed to create experiment" },
      { status: 500 }
    )
  }
}
