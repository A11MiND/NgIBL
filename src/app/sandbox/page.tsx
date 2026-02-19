import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Sparkles } from "lucide-react"
import SimulationCard from "@/app/library/simulation-card"

export default async function SandboxPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })
  if (!user) redirect("/login")

  const simulations = await prisma.simulation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sandbox</h1>
          <p className="text-muted-foreground">Create and manage AI-generated interactive simulations</p>
        </div>
        <Button asChild>
          <Link href="/sandbox/new">
            <Plus className="mr-2 h-4 w-4" />
            New Simulation
          </Link>
        </Button>
      </div>

      {simulations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Sparkles className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No simulations yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Describe what you want and AI will create an interactive simulation
            </p>
            <Button asChild>
              <Link href="/sandbox/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Simulation
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {simulations.map((simulation) => (
            <SimulationCard key={simulation.id} simulation={simulation} />
          ))}
        </div>
      )}
    </div>
  )
}
