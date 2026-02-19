"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { cn } from "@/lib/utils"

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
        <nav className="flex items-center gap-1">
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
      </div>
    </header>
  )
}
