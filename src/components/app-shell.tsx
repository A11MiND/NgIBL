"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { cn } from "@/lib/utils"
import { Menu, X } from "lucide-react"

interface NavItem {
  label: string
  href: string
}

export function AppNav({ navItems, logoutLabel, onLogout }: {
  navItems: NavItem[]
  logoutLabel: string
  onLogout: () => void
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/")
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="bg-white dark:bg-card border-b sticky top-0 z-40">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-bold text-gray-900 dark:text-foreground">
          IBL Platform
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium px-3 py-1.5 rounded-md transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className="w-px h-5 bg-border mx-1.5" />
          <ModeToggle />
          <LanguageToggle />
          <form action={onLogout}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              {logoutLabel}
            </Button>
          </form>
        </nav>

        {/* Mobile hamburger */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-white dark:bg-card px-4 pb-4 pt-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block text-sm font-medium px-3 py-2 rounded-md transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex items-center gap-2 px-3 pt-2 border-t mt-2">
            <ModeToggle />
            <LanguageToggle />
            <form action={onLogout}>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                {logoutLabel}
              </Button>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
