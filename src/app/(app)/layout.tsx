import Link from "next/link"
import { redirect } from "next/navigation"
import { BookOpen } from "lucide-react"
import { AppSidebar } from "@/components/app/app-sidebar"
import { AppHeaderMeny } from "@/components/app/app-header-meny"
import { ToFaktorPaaminnelse } from "@/components/app/to-faktor-paaminnelse"
import { MeldingVisning } from "@/components/app/melding-visning"
import { KonsultasjonProvider } from "@/hooks/use-konsultasjon"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { harGyldigSignatur } from "@/lib/dpa"
import { prisma } from "@/lib/db"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const erAdmin = isAdmin(session?.user?.email)
  const visNavn = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Bruker"

  const bruker = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { twoFactorEnabled: true, dpaSignedAt: true, dpaVersion: true },
      })
    : null

  // Ingen appbruk uten gyldig signert databehandleravtale
  if (session?.user?.id && !(await harGyldigSignatur(bruker))) {
    redirect("/godta-avtale")
  }

  // Aktive meldinger fra admin som brukeren ikke har bekreftet lest, eldste først
  const ulesteMeldinger = session?.user?.id
    ? await prisma.melding.findMany({
        where: { aktiv: true, lest: { none: { userId: session.user.id } } },
        select: { id: true, tittel: true, innhold: true, publisertAt: true },
        orderBy: { publisertAt: "asc" },
      })
    : []

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
          <div className="flex items-center gap-1">
            <Link
              href="/innstillinger?tab=prompts"
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors px-2 py-1.5 rounded-md hover:bg-slate-100"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Promptbibliotek</span>
            </Link>
            <AppHeaderMeny visNavn={visNavn} erAdmin={erAdmin} />
          </div>
        </header>

        {/* Sidebar + innhold */}
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <ToFaktorPaaminnelse er2FAaktivert={bruker?.twoFactorEnabled ?? true} />
      <MeldingVisning
        meldinger={ulesteMeldinger.map((m) => ({ ...m, publisertAt: m.publisertAt.toISOString() }))}
      />
    </KonsultasjonProvider>
  )
}
