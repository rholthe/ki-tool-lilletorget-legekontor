import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { isAdmin } from "@/lib/admin"
import { hentGjeldendeDpa } from "@/lib/dpa"
import { Markdown } from "@/components/dpa/markdown"
import { OpprettDpaSkjema } from "@/components/admin/opprett-dpa-skjema"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, Plus, History } from "lucide-react"

function datoNo(d: Date) {
  return new Date(d).toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" })
}

export default async function AdminDpaSide() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect("/innstillinger")
  }

  const [versjoner, gjeldende] = await Promise.all([
    prisma.dpaVersjon.findMany({ orderBy: { publisertAt: "desc" } }),
    hentGjeldendeDpa(),
  ])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-slate-800">Databehandleravtale</h1>
        </div>
        <p className="text-sm text-slate-500">
          Opprett nye versjoner av avtalen. Publiserte versjoner kan ikke endres.
          Ved betydelig endring må alle brukere signere på nytt ved neste innlogging.
        </p>
      </div>

      <Separator />

      {/* Ny versjon */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Ny versjon</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <OpprettDpaSkjema forrigeInnhold={gjeldende.innhold} />
        </div>
      </section>

      <Separator />

      {/* Historikk */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Tidligere versjoner
          </h2>
        </div>

        {versjoner.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ingen versjoner er opprettet ennå. Inntil videre vises en
            innebygd standardtekst (versjon {gjeldende.versjon}) på den offentlige
            siden.
          </p>
        ) : (
          <div className="space-y-3">
            {versjoner.map((v) => (
              <details
                key={v.id}
                className="rounded-xl border border-slate-200 bg-white px-5 py-4"
              >
                <summary className="cursor-pointer flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">Versjon {v.versjon}</span>
                    {v.gjeldende && (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                        Gjeldende
                      </Badge>
                    )}
                    {v.krevNySignering && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                        Krevde ny signering
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">{datoNo(v.publisertAt)}</span>
                </summary>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Markdown>{v.innhold}</Markdown>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
