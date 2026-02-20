"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Experiment, WorksheetQuestion, Simulation } from "@prisma/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, ArrowLeft, Eye, Share2 } from "lucide-react"
import Link from "next/link"
import QRCode from "react-qr-code"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { testConnectionAction, generateWorksheetQuestionsAction } from "./actions"
import { Loader2, Beaker, Sparkles } from "lucide-react"
import { Dictionary } from "@/lib/dictionary"
import SimulationSelector from "./simulation-selector"

type ExperimentWithQuestions = Experiment & {
  questions: WorksheetQuestion[]
  simulation?: Simulation | null
}

interface ExperimentEditorProps {
  experiment: ExperimentWithQuestions
  mySimulations: Simulation[]
  communitySimulations: Simulation[]
  dict: Dictionary
}

export default function ExperimentEditor({ experiment, mySimulations, communitySimulations, dict }: ExperimentEditorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [activeTab, setActiveTab] = useState("settings")
  
  // Form states
  const [title, setTitle] = useState(experiment.title)
  const [description, setDescription] = useState(experiment.description || "")
  const [aiContext, setAiContext] = useState(experiment.aiContext || "")
  const [aiModel, setAiModel] = useState(experiment.aiModel || "gemini-1.5-flash")
  const [systemPrompt, setSystemPrompt] = useState(experiment.systemPrompt || "")
  const [temperature, setTemperature] = useState(experiment.temperature || 0.7)
  const [simulationId, setSimulationId] = useState<string | null>(experiment.simulationId || null)
  const [allowImageUpload, setAllowImageUpload] = useState(experiment.allowImageUpload ?? false)
  
  // Questions state
  const [questions, setQuestions] = useState<WorksheetQuestion[]>(experiment.questions)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)

  const studentUrl = typeof window !== 'undefined' ? `${window.location.origin}/experiment/${experiment.slug}` : ''

  async function handleTestConnection() {
    setTestingConnection(true)
    try {
      const result = await testConnectionAction(aiModel)
      if (result.success) {
        alert(`Success: ${result.message}`)
      } else {
        alert(`Error: ${result.message}`)
      }
    } catch (e) {
      alert("Connection failed")
    } finally {
      setTestingConnection(false)
    }
  }

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/experiments/${experiment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          aiContext,
          aiModel,
          systemPrompt,
          temperature,
          simulationId,
          allowImageUpload,
          questions: questions.map((q, i) => ({ ...q, order: i }))
        }),
      })
      
      if (!res.ok) throw new Error("Failed to save")
      
      router.refresh()
      alert("Saved successfully!")
    } catch (error) {
      console.error(error)
      alert("Error saving changes")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{title}</h1>
            <p className="text-sm text-muted-foreground">{dict.editor.title}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                {dict.editor.share}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{dict.editor.shareTitle}</DialogTitle>
                <DialogDescription>
                  {dict.editor.shareDesc}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center p-6 space-y-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <QRCode value={studentUrl} size={200} />
                </div>
                <p className="text-sm text-muted-foreground break-all text-center">
                  {studentUrl}
                </p>
                <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(studentUrl)}>
                  {dict.editor.copyLink}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" asChild>
            <Link href={`/experiment/${experiment.slug}`} target="_blank">
              <Eye className="mr-2 h-4 w-4" />
              {dict.editor.preview}
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? dict.editor.saving : dict.editor.save}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">{dict.editor.settings}</TabsTrigger>
          <TabsTrigger value="simulation">{dict.editor.simulation}</TabsTrigger>
          <TabsTrigger value="worksheet">{dict.editor.worksheet}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>{dict.editor.generalSettings}</CardTitle>
              <CardDescription>Basic information about the experiment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{dict.editor.titleLabel}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{dict.editor.descriptionLabel}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-4">{dict.editor.aiTutor}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{dict.editor.aiModelLabel}</Label>
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deepseek-chat">DeepSeek Chat (V3.2)</SelectItem>
                          <SelectItem value="deepseek-reasoner">DeepSeek Reasoner (Thinking)</SelectItem>
                          <SelectItem value="qwen-max">Qwen3 Max</SelectItem>
                          <SelectItem value="qwen-plus">Qwen Plus (1M context)</SelectItem>
                          <SelectItem value="qwen-turbo">Qwen Flash (1M context)</SelectItem>
                          <SelectItem value="qwen3-vl-plus">Qwen3 VL Plus (Vision)</SelectItem>
                          <SelectItem value="qwen3-vl-flash">Qwen3 VL Flash (Vision)</SelectItem>
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{dict.editor.temperatureLabel} ({temperature})</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        max="2" 
                        step="0.1" 
                        value={temperature} 
                        onChange={(e) => setTemperature(parseFloat(e.target.value))} 
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <input
                      type="checkbox"
                      id="allowImageUpload"
                      checked={allowImageUpload}
                      onChange={(e) => {
                        setAllowImageUpload(e.target.checked)
                        if (e.target.checked && !aiModel.includes('qwen3-vl')) {
                          setAiModel('qwen3-vl-plus')
                        }
                      }}
                    />
                    <div>
                      <Label htmlFor="allowImageUpload" className="cursor-pointer">
                        {dict.editor?.allowImageUpload || 'Allow students to upload images in AI Tutor'}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {dict.editor?.allowImageUploadDesc || 'Requires a Vision model (e.g. Qwen 3.5 Plus). Students can take photos of their work for AI analysis.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{dict.editor.systemPromptLabel}</Label>
                    <Textarea 
                      value={systemPrompt} 
                      onChange={(e) => setSystemPrompt(e.target.value)} 
                      placeholder="You are a helpful tutor..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{dict.editor.aiContextLabel}</Label>
                    <Textarea 
                      value={aiContext} 
                      onChange={(e) => setAiContext(e.target.value)} 
                      placeholder={dict.editor.aiContextPlaceholder}
                      className="min-h-[150px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      This content will be used by the AI Tutor to answer student questions accurately.
                    </p>
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={handleTestConnection} 
                    disabled={testingConnection}
                    className="w-full"
                  >
                    {testingConnection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Beaker className="mr-2 h-4 w-4" />}
                    {dict.editor.testConnection}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulation">
          <Card>
            <CardHeader>
              <CardTitle>{dict.editor.simulationConfig}</CardTitle>
              <CardDescription>
                Choose a simulation from your library, community, or create a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimulationSelector
                mySimulations={mySimulations}
                communitySimulations={communitySimulations}
                currentSimulationId={simulationId}
                onSelect={(sim) => setSimulationId(sim.id)}
                dict={dict}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="worksheet">
          <Card>
            <CardHeader>
              <CardTitle>{dict.editor.worksheetQuestions}</CardTitle>
              <CardDescription>Manage the questions students will answer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {questions.map((q, index) => (
                <div key={q.id || index} className="p-4 border rounded-lg space-y-4 bg-gray-50 relative">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <Label>{dict.editor.questionLabel} {index + 1}</Label>
                      <Input 
                        value={q.question} 
                        onChange={(e) => {
                          const newQuestions = [...questions]
                          newQuestions[index].question = e.target.value
                          setQuestions(newQuestions)
                        }}
                        placeholder="Enter question text"
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-700 ml-2"
                      onClick={() => {
                        const newQuestions = questions.filter((_, i) => i !== index)
                        setQuestions(newQuestions)
                      }}
                    >
                      {dict.editor.remove}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{dict.editor.typeLabel}</Label>
                      <Select 
                        value={q.type} 
                        onValueChange={(val) => {
                          const newQuestions = [...questions]
                          newQuestions[index].type = val
                          setQuestions(newQuestions)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SHORT">Short Answer</SelectItem>
                          <SelectItem value="LONG">Long Answer</SelectItem>
                          <SelectItem value="MCQ">Multiple Choice</SelectItem>
                          <SelectItem value="FILL_IN">Fill in the Blank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {q.type === "MCQ" && (
                      <div className="space-y-2">
                        <Label>{dict.editor.optionsLabel}</Label>
                        <Input 
                          value={Array.isArray(q.options) ? (q.options as string[]).join(", ") : ""} 
                          onChange={(e) => {
                            const newQuestions = [...questions]
                            newQuestions[index].options = e.target.value.split(",").map(s => s.trim())
                            setQuestions(newQuestions)
                          }}
                          placeholder="Option A, Option B, Option C"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 border-dashed" 
                  onClick={() => {
                    setQuestions([
                      ...questions, 
                      { 
                        id: "",
                        experimentId: experiment.id,
                        type: "SHORT", 
                        question: "", 
                        options: null, 
                        order: questions.length 
                      } as any
                    ])
                  }}
                >
                  + {dict.editor.addQuestion}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={generatingQuestions}
                  onClick={async () => {
                    setGeneratingQuestions(true)
                    try {
                      // Find simulation code if linked
                      const linkedSim = [...mySimulations, ...communitySimulations].find(s => s.id === simulationId)
                      const result = await generateWorksheetQuestionsAction({
                        experimentId: experiment.id,
                        subject: experiment.subject,
                        title,
                        description,
                        simulationCode: linkedSim?.reactCode || undefined,
                        count: 5,
                      })
                      if (result.success && result.questions) {
                        const newQs = result.questions.map((q, i) => ({
                          id: "",
                          experimentId: experiment.id,
                          type: q.type,
                          question: q.question,
                          options: q.options,
                          order: questions.length + i,
                        } as any))
                        setQuestions([...questions, ...newQs])
                      } else {
                        alert(result.error || 'Failed to generate questions')
                      }
                    } catch (e: any) {
                      alert(e.message || 'Generation failed')
                    }
                    setGeneratingQuestions(false)
                  }}
                >
                  {generatingQuestions ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> AI Generate Questions</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
