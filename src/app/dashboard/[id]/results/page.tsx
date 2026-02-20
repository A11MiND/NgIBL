import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/auth"
import { ExportButton } from "@/components/export-button"
import { getDictionary } from "@/lib/get-dictionary"
import { AnalysisPanel } from "./analysis-panel"
import { StudentAnalysisButton } from "./student-analysis-button"

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) redirect("/login")

  const dict = await getDictionary()

  const { id } = await params
  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: {
      submissions: {
        orderBy: { submittedAt: 'desc' },
        include: {
          answers: {
            include: { question: true }
          }
        }
      },
      questions: {
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!experiment) notFound()

  if (experiment.userId !== user.id) {
    redirect("/dashboard")
  }

  // Prepare data for CSV export
  const exportData = experiment.submissions.map(sub => {
    const row: any = {
      [dict.results.studentName]: sub.studentName,
      [dict.results.id]: sub.studentId,
      [dict.results.class]: sub.class,
      [dict.results.submittedAt]: new Date(sub.submittedAt).toLocaleString(),
    }
    
    experiment.questions.forEach(q => {
      const ans = sub.answers.find(a => a.questionId === q.id)
      row[q.question] = ans?.value || ""
    })
    
    return row
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{experiment.title} - {dict.results.title}</h1>
            <p className="text-sm text-muted-foreground">{experiment.submissions.length} {dict.results.submissions}</p>
          </div>
        </div>
        <ExportButton 
          data={exportData} 
          filename={`${experiment.title}-results.csv`} 
          label={dict.results.exportCsv}
        />
      </div>

      {/* AI Analysis */}
      {experiment.submissions.length > 0 && (
        <AnalysisPanel experimentId={experiment.id} dict={dict} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{dict.results.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.results.studentName}</TableHead>
                  <TableHead>{dict.results.id}</TableHead>
                  <TableHead>{dict.results.class}</TableHead>
                  <TableHead>{dict.results.submittedAt}</TableHead>
                  <TableHead>{dict.results.answers}</TableHead>
                  <TableHead>{dict.results?.actions || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experiment.submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.studentName}</TableCell>
                    <TableCell>{sub.studentId}</TableCell>
                    <TableCell>{sub.class}</TableCell>
                    <TableCell>{new Date(sub.submittedAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <details>
                        <summary className="cursor-pointer text-blue-600 hover:underline">{dict.results.viewAnswers}</summary>
                        <div className="mt-2 space-y-2 p-2 bg-gray-50 rounded text-xs min-w-[200px] dark:bg-muted">
                          {experiment.questions.map(q => {
                            const ans = sub.answers.find(a => a.questionId === q.id)
                            return (
                              <div key={q.id} className="border-b pb-1 last:border-0">
                                <p className="font-semibold text-gray-700 dark:text-gray-300">{q.question}</p>
                                <p className="text-gray-600 dark:text-gray-400">{ans?.value || "No answer"}</p>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    </TableCell>
                    <TableCell>
                      <StudentAnalysisButton
                        experimentId={experiment.id}
                        submissionId={sub.id}
                        studentName={sub.studentName}
                        dict={dict}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {experiment.submissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 h-24">
                      {dict.results.noSubmissions}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
