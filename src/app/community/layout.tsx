import AppLayout from "@/components/app-layout"

export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
