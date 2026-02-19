"use client"

import { Button } from "@/components/ui/button"
import { Languages } from "lucide-react"
import { useRouter } from "next/navigation"

export function LanguageToggle() {
  const router = useRouter()

  const toggleLanguage = () => {
    const current = document.cookie.replace(/(?:(?:^|.*;\s*)NEXT_LOCALE\s*\=\s*([^;]*).*$)|^.*$/, "$1")
    const next = current === "zh" ? "en" : "zh"
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`
    router.refresh()
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleLanguage} title="Switch Language">
      <Languages className="h-[1.2rem] w-[1.2rem]" />
    </Button>
  )
}
