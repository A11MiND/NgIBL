"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  MoreVertical, Trash2, Copy, Eye, EyeOff, Edit, Code, Atom, Dna, 
  FlaskConical, BookOpen 
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import SimulationRunner from "@/components/simulation-runner"
import { deleteSimulation, duplicateSimulation, togglePublicSimulation } from "./actions"
import { useRouter } from "next/navigation"

interface Simulation {
  id: string
  title: string
  description: string | null
  subject: string
  type: string
  reactCode: string | null
  geogebraFile: string | null
  geogebraMaterialId: string | null
  geogebraCommands: any
  geogebraSettings: any
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

export default function SimulationCard({ simulation }: { simulation: Simulation }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const getIcon = (subject: string) => {
    switch (subject) {
      case "Physics": return <Atom className="h-5 w-5 text-blue-500" />
      case "Chemistry": return <FlaskConical className="h-5 w-5 text-purple-500" />
      case "Biology": return <Dna className="h-5 w-5 text-green-500" />
      case "Math": case "Maths": return <Code className="h-5 w-5 text-orange-500" />
      default: return <BookOpen className="h-5 w-5 text-gray-500" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "REACT": return "React"
      case "GEOGEBRA_FILE": return "GeoGebra File"
      case "GEOGEBRA_API": return "GeoGebra"
      default: return type
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSimulation(simulation.id)
      if (!result.success) {
        alert('Failed to delete: ' + result.error)
      }
      setShowDeleteDialog(false)
    })
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateSimulation(simulation.id)
      if (!result.success) {
        alert('Failed to duplicate: ' + result.error)
      }
    })
  }

  function handleTogglePublic() {
    startTransition(async () => {
      const result = await togglePublicSimulation(simulation.id)
      if (!result.success) {
        alert('Failed to update visibility: ' + result.error)
      }
    })
  }

  return (
    <>
      <Card className="group relative hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getIcon(simulation.subject)}
              <CardTitle className="truncate text-base">{simulation.title}</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setShowPreview(true)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/sandbox/${simulation.id}`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit in Sandbox
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleTogglePublic} disabled={isPending}>
                  {simulation.isPublic ? (
                    <><EyeOff className="mr-2 h-4 w-4" /> Make Private</>
                  ) : (
                    <><Eye className="mr-2 h-4 w-4" /> Publish</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardDescription className="flex items-center gap-2 text-xs">
            <span>{simulation.subject}</span>
            <span>·</span>
            <span>{getTypeLabel(simulation.type)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
            {simulation.description || "No description provided."}
          </p>
          
          {simulation.isPublic && (
            <div className="flex items-center gap-1 mt-3">
              <Eye className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600 font-medium">Public</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{simulation.title}</DialogTitle>
            <DialogDescription>{simulation.description}</DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            <SimulationRunner simulation={simulation} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Simulation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete &quot;{simulation.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
