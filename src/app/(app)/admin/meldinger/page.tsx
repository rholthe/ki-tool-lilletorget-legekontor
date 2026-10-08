import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { isAdmin } from "@/lib/admin"
import { Markdown } from "@/components/dpa/markdown"
import { OpprettMeldingSkjema } from "@/components/admin/opprett-melding-skjema"
import { MeldingAktivKnapp } from "@/components/admin/melding-aktiv-knapp"
import { SIKKERHETSMELDING_FORSLAG } from "@/lib/meldinger-forslag"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Megaphone, Plus, History } from "lucide-react"

function datoNo(d: Date) {
  return new Date(d).toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" })
}

export default async function AdminMeldingerSide() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect("/innstillinger")
  }

  const [meldinger, brukere] = await Promise.all([
    prisma.melding.findMany({
      orderBy: { publisertAt: "desc" },
      include: { lest: { select: { userId: true, lestAt: true } } },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const navn = (b: { name: string | null; email: string }) => b.name ?? b.email

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-slate-800">Meldinger til brukerne</h1>
        </div>
        <p className="text-sm text-slate-500">
          En publisert melding vises øverst i appen for alle brukere, én gang, til de
          trykker «Jeg har lest». Her ser du hvem som har lest hver melding.
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Ny melding</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <OpprettMeldingSkjema forslag={meldinger.length === 0 ? SIKKERHETSMELDING_FORSLAG : undefined} />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Publiserte meldinger</h2>
        </div>

        {meldinger.length === 0 ? (
          <p className="text-sm text-slate-500">Ingen meldinger er publisert ennå.</p>
        ) : (
          <div className="space-y-3">
            {meldinger.map((m) => {
              const lestAv = new Set(m.lest.map((l) => l.userId))
              const ikkeLest = brukere.filter((b) => !lestAv.has(b.id))
              return (
                <details key={m.id} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                  <summary className="cursor-pointer flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-slate-800 truncate">{m.tittel}</span>
                      {m.aktiv ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Aktiv</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">Trukket tilbake</Badge>
                      )}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      Lest av {lestAv.size} av {brukere.length} · {datoNo(m.publisertAt)}
                    </span>
                  </summary>
                  <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
                    <Markdown>{m.innhold}</Markdown>
                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
                      <p>
                        <span className="font-medium text-slate-700">Har lest:</span>{" "}
                        {brukere.filter((b) => lestAv.has(b.id)).map(navn).join(", ") || "ingen ennå"}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Har ikke lest:</span>{" "}
                        {ikkeLest.map(navn).join(", ") || "alle har lest"}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <MeldingAktivKnapp id={m.id} aktiv={m.aktiv} />
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
