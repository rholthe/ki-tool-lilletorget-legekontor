import { AppSidebar } from "@/components/app/app-sidebar"
import { AppHeaderMeny } from "@/components/app/app-header-meny"
import { KonsultasjonProvider } from "@/hooks/use-konsultasjon"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const erAdmin = isAdmin(session?.user?.email)
  const visNavn = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Bruker"

  return (
    <KonsultasjonProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
        {/* Toppheader */}
        <header className="h-11 border-b border-slate-200 bg-white flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">LA</span>
            </div>
            <span className="font-semibold text-slate-800 text-sm">legeassist</span>
          </div>
          <AppHeaderMeny visNavn={visNavn} erAdmin={erAdmin} />
        </header>

        {/* Sidebar + innhold */}
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </KonsultasjonProvider>
  )
}
