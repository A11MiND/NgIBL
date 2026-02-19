"use client"

import { useState, useRef, useCallback } from "react"

const MAX_SIZE_BYTES = 1 * 1024 * 1024 // 1MB
const MAX_DIMENSION = 1024

/**
 * Compress an image if it exceeds MAX_SIZE_BYTES.
 * Returns a base64 data-URL string.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (file.size <= MAX_SIZE_BYTES) {
        resolve(dataUrl)
        return
      }
      // Compress via canvas
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.8))
      }
      img.onerror = reject
      img.src = dataUrl
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export interface UseImageUploadReturn {
  pendingImages: string[]
  addImages: (files: FileList | File[]) => Promise<void>
  removeImage: (index: number) => void
  clearImages: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  triggerUpload: () => void
  handlePaste: (e: React.ClipboardEvent) => void
  handleDrop: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
}

export function useImageUpload(maxImages: number = 4): UseImageUploadReturn {
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const addImages = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith("image/"))
    if (fileArr.length === 0) return

    const results: string[] = []
    for (const file of fileArr) {
      try {
        const base64 = await compressImage(file)
        results.push(base64)
      } catch (err) {
        console.error("Failed to process image:", err)
      }
    }

    setPendingImages(prev => {
      const combined = [...prev, ...results]
      return combined.slice(0, maxImages)
    })
  }, [maxImages])

  const removeImage = useCallback((index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearImages = useCallback(() => {
    setPendingImages([])
  }, [])

  const triggerUpload = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      addImages(imageFiles)
    }
  }, [addImages])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      addImages(files)
    }
  }, [addImages])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return {
    pendingImages,
    addImages,
    removeImage,
    clearImages,
    inputRef,
    triggerUpload,
    handlePaste,
    handleDrop,
    handleDragOver,
  }
}
