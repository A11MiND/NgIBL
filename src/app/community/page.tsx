import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import CommunityGrid from "./community-grid"
import { getDictionary } from "@/lib/get-dictionary"

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: { search?: string; subject?: string; sort?: string }
}) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) redirect("/login")

  const dict = await getDictionary()

  // Build filter conditions
  const where: any = { isPublic: true }
  
  if (searchParams.search) {
    where.OR = [
      { title: { contains: searchParams.search, mode: 'insensitive' } },
      { description: { contains: searchParams.search, mode: 'insensitive' } }
    ]
  }
  
  if (searchParams.subject) {
    where.subject = searchParams.subject
  }

  // Build sort order
  let orderBy: any = { updatedAt: 'desc' }
  if (searchParams.sort === 'views') {
    orderBy = { views: 'desc' }
  } else if (searchParams.sort === 'forks') {
    orderBy = { forks: 'desc' }
  }

  const simulations = await prisma.simulation.findMany({
    where,
    orderBy,
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{dict.community.title}</h1>
        <p className="text-muted-foreground">{dict.community.subtitle}</p>
      </div>

      <CommunityGrid simulations={simulations} currentUserId={user.id} />
    </div>
  )
}
