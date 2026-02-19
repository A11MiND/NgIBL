"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface ExportButtonProps {
  data: any[]
  filename?: string
  label?: string
}

export function ExportButton({ data, filename = "export.csv", label = "Export CSV" }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert("No data to export")
      return
    }

    // Generate CSV
    // Get all unique keys from answers to form columns
    // Structure: Student Name, ID, Class, Submitted At, Q1, Q2...
    
    // First, find all questions across all submissions to ensure we have all columns
    // But usually questions are consistent per experiment.
    // We'll assume the passed data is formatted for export or we format it here.
    // Let's assume data is the raw submissions array with answers included.
    
    // We need to know the questions to make headers.
    // But the component receives just data.
    // Let's make the caller format the data into a flat array of objects.
    
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(fieldName => {
        const val = row[fieldName]
        // Escape quotes and wrap in quotes if contains comma
        const stringVal = String(val === null || val === undefined ? "" : val)
        if (stringVal.includes(",") || stringVal.includes('"') || stringVal.includes("\n")) {
          return `"${stringVal.replace(/"/g, '""')}"`
        }
        return stringVal
      }).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}
