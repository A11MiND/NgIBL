import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ExternalLink, BarChart, Trash2, FlaskConical, Atom, Dna, BookOpen } from "lucide-react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DeleteExperimentButton } from "./delete-button"
import { getDictionary } from "@/lib/get-dictionary"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) redirect("/login")

  const dict = await getDictionary()

  const experiments = await prisma.experiment.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { submissions: true }
      }
    }
  })

  const getIcon = (subject: string) => {
    switch (subject) {
      case "Physics": return <Atom className="h-5 w-5 text-blue-500" />
      case "Chemistry": return <FlaskConical className="h-5 w-5 text-purple-500" />
      case "Biology": return <Dna className="h-5 w-5 text-green-500" />
      case "Math": case "Maths": return <BookOpen className="h-5 w-5 text-orange-500" />
      default: return <BookOpen className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{dict.dashboard.title}</h1>
          <p className="text-muted-foreground">{dict.dashboard.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/create">
            <Plus className="mr-2 h-4 w-4" />
            {dict.dashboard.create}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {experiments.map((experiment) => (
          <Card key={experiment.id} className="group relative hover:shadow-md transition-shadow">
            <Link href={`/dashboard/${experiment.id}/edit`} className="absolute inset-0 z-0" />
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  {getIcon(experiment.subject)}
                  <span className="truncate">{experiment.title}</span>
                </div>
                {experiment.isPublished && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full shrink-0 dark:bg-green-900 dark:text-green-100">{dict.dashboard.published}</span>
                )}
              </CardTitle>
              <CardDescription>{experiment.subject}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[40px] dark:text-gray-400">
                {experiment.description || "No description provided."}
              </p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t relative z-10">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {experiment._count.submissions} {dict.dashboard.submissions}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" asChild title={dict.dashboard.viewResults}>
                    <Link href={`/dashboard/${experiment.id}/results`}>
                      <BarChart className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild title={dict.dashboard.edit}>
                    <Link href={`/dashboard/${experiment.id}/edit`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <DeleteExperimentButton id={experiment.id} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {experiments.length === 0 && (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FlaskConical className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-1">{dict.dashboard.noExperiments}</h3>
              <p className="text-muted-foreground text-sm mb-4">{dict.dashboard.getStarted}</p>
              <Button asChild>
                <Link href="/dashboard/create">{dict.dashboard.create}</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
