"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageCircle, X, Send, Loader2, Bot, ImagePlus } from "lucide-react"
import { chatWithTutor } from "@/app/experiment/[slug]/actions"
import { useImageUpload } from "@/lib/use-image-upload"
import { ImagePreviewBar } from "@/components/image-preview-bar"

interface Message {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

export default function StudentChatbot({
  experimentId,
  allowImageUpload = false,
}: {
  experimentId: string
  allowImageUpload?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your AI tutor. Ask me anything about this experiment!" }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const imageUpload = useImageUpload(2)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if ((!input.trim() && imageUpload.pendingImages.length === 0) || loading) return

    const userMsg = input.trim()
    const images = [...imageUpload.pendingImages]
    setInput("")
    imageUpload.clearImages()
    setMessages(prev => [...prev, { role: 'user', content: userMsg, images: images.length > 0 ? images : undefined }])
    setLoading(true)

    try {
      // Convert messages to format expected by server (without images in history to keep payload small)
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const response = await chatWithTutor(
        experimentId,
        userMsg,
        history,
        images.length > 0 ? images : undefined
      )
      
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, something went wrong." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!isOpen && (
        <Button
          className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg z-50"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-80 md:w-96 h-[100dvh] sm:h-[min(500px,80dvh)] sm:rounded-lg rounded-none shadow-xl z-50 flex flex-col animate-in slide-in-from-bottom-10 fade-in">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base">AI Tutor</CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary/90" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {m.images && m.images.length > 0 && (
                      <div className="flex gap-1 mb-1.5 flex-wrap">
                        {m.images.map((src, j) => (
                          <img key={j} src={src} alt="" className="h-14 w-14 rounded object-cover border border-white/20" />
                        ))}
                      </div>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
            <div className="border-t">
              {imageUpload.pendingImages.length > 0 && (
                <div className="px-3 pt-2">
                  <ImagePreviewBar images={imageUpload.pendingImages} onRemove={imageUpload.removeImage} compact />
                </div>
              )}
              <form onSubmit={handleSend} className="p-3 flex gap-2">
                {allowImageUpload && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={imageUpload.triggerUpload}
                      title="Upload image"
                    >
                      <ImagePlus className="h-4 w-4" />
                    </Button>
                    <input
                      ref={imageUpload.inputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) imageUpload.addImages(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </>
                )}
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={allowImageUpload ? imageUpload.handlePaste : undefined}
                  placeholder={allowImageUpload ? "Ask or paste an image..." : "Ask a question..."}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={loading || (!input.trim() && imageUpload.pendingImages.length === 0)}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
