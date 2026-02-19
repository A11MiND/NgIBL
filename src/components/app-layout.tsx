import { signOut } from "@/auth"
import { getDictionary } from "@/lib/get-dictionary"
import { AppNav } from "@/components/app-shell"

export default async function AppLayout({
  children,
  withPadding = true,
}: {
  children: React.ReactNode
  withPadding?: boolean
}) {
  const dict = await getDictionary()

  const navItems = [
    { label: dict.nav.dashboard, href: "/dashboard" },
    { label: dict.nav.sandbox, href: "/sandbox" },
    { label: dict.nav.community, href: "/community" },
    { label: dict.nav.settings, href: "/dashboard/settings" },
  ]

  async function handleLogout() {
    "use server"
    await signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <AppNav navItems={navItems} logoutLabel={dict.nav.logout} onLogout={handleLogout} />
      {withPadding ? (
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      ) : (
        children
      )}
    </div>
  )
}
