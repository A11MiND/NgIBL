"use client"

import { useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
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
import { deleteSimulationAction } from "./sim-actions"

export function SimulationActions({ simulationId }: { simulationId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDelete, setShowDelete] = useState(false)

  function handleDelete() {
    startTransition(async () => {
      await deleteSimulationAction(simulationId)
      setShowDelete(false)
    })
  }

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => { e.preventDefault(); router.push(`/sandbox/${simulationId}`) }}
        title="Edit"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={(e) => { e.preventDefault(); setShowDelete(true) }}
        title="Delete"
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Simulation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The simulation will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
