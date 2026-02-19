"use client"

import { useState } from "react"
import { Experiment, WorksheetQuestion, Simulation } from "@prisma/client"
import SimulationRunner from "@/components/simulation-runner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import StudentChatbot from "@/components/student-chatbot"

type ExperimentWithQuestions = Experiment & {
  questions: WorksheetQuestion[]
  simulation?: Simulation | null
}

export default function StudentView({ experiment }: { experiment: ExperimentWithQuestions }) {
  const [studentInfo, setStudentInfo] = useState<{ name: string; id: string; class: string } | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!studentInfo && !isPreview) {
    return <StudentEntryForm experimentTitle={experiment.title} onJoin={setStudentInfo} onPreview={() => setIsPreview(true)} />
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-green-600">Submission Received!</CardTitle>
            <CardDescription>
              Thank you, {studentInfo?.name || "Guest"}. Your work has been recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>Start Over</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm("Are you sure you want to submit? You cannot change your answers afterwards.")) return

    if (!studentInfo) {
      alert("Guest users cannot submit worksheets. Please reload and enter your details.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/experiments/${experiment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student: studentInfo,
          answers
        }),
      })

      if (!res.ok) throw new Error("Submission failed")
      setSubmitted(true)
    } catch (error) {
      console.error(error)
      alert("Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col md:flex-row overflow-hidden">
      {/* Left Panel: Simulation */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full bg-gray-100 border-r overflow-auto relative">
        <div className="absolute inset-0">
          <SimulationRunner simulation={experiment.simulation ?? null} />
        </div>
      </div>

      {/* Right Panel: Worksheet */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full bg-white overflow-auto">
        <div className="p-6 max-w-2xl mx-auto">
          <div className="mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold">{experiment.title}</h1>
            <div className="flex gap-4 text-sm text-muted-foreground mt-2">
              <span>Student: {studentInfo?.name || "Guest"}</span>
              {studentInfo?.id && <span>ID: {studentInfo.id}</span>}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 pb-20">
            {experiment.questions.map((q, index) => (
              <Card key={q.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">
                    {index + 1}. {q.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {q.type === "MCQ" && q.options && (
                    <RadioGroup 
                      value={answers[q.id] || ""} 
                      onValueChange={(val: string) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                    >
                      {(q.options as string[]).map((opt, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt} id={`${q.id}-${i}`} />
                          <Label htmlFor={`${q.id}-${i}`}>{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {(q.type === "SHORT" || q.type === "FILL_IN") && (
                    <Input 
                      value={answers[q.id] || ""} 
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Your answer..." 
                    />
                  )}

                  {q.type === "LONG" && (
                    <Textarea 
                      value={answers[q.id] || ""} 
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Type your detailed answer here..." 
                      className="min-h-[100px]"
                    />
                  )}
                </CardContent>
              </Card>
            ))}

            {experiment.questions.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No questions in this worksheet. Enjoy the simulation!
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Worksheet"}
            </Button>
          </form>
        </div>
      </div>
      
      <StudentChatbot experimentId={experiment.id} allowImageUpload={experiment.allowImageUpload} />
    </div>
  )
}

function StudentEntryForm({ experimentTitle, onJoin, onPreview }: { experimentTitle: string, onJoin: (info: any) => void, onPreview: () => void }) {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    onJoin({
      name: formData.get("name"),
      id: formData.get("studentId"),
      class: formData.get("class")
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Student Details</CardTitle>
          <CardDescription>Enter your details to start: {experimentTitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" required placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input id="studentId" name="studentId" required placeholder="12345678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              <Input id="class" name="class" required placeholder="10A" />
            </div>
            <Button type="submit" className="w-full">Start Worksheet</Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={onPreview}>
              Preview as Guest
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
