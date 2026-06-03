import { AppSidebar } from "@/components/app/app-sidebar"
import { KonsultasjonProvider } from "@/hooks/use-konsultasjon"
import { auth } from "@/lib/auth"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <KonsultasjonProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <AppSidebar
          brukerNavn={session?.user?.name ?? null}
          brukerEpost={session?.user?.email ?? null}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </KonsultasjonProvider>
  )
}
