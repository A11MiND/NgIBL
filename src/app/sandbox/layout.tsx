import AppLayout from "@/components/app-layout"

export default async function SandboxLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
