"use client"

import { X } from "lucide-react"

interface ImagePreviewBarProps {
  images: string[]
  onRemove: (index: number) => void
  compact?: boolean
}

export function ImagePreviewBar({ images, onRemove, compact }: ImagePreviewBarProps) {
  if (images.length === 0) return null

  const size = compact ? "h-12 w-12" : "h-16 w-16"

  return (
    <div className="flex gap-2 flex-wrap py-1.5">
      {images.map((src, i) => (
        <div key={i} className={`relative ${size} rounded-md overflow-hidden border group`}>
          <img src={src} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
