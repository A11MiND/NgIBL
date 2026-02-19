import AppLayout from "@/components/app-layout"

export default async function LibraryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
