import Link from "next/link"
import { redirect } from "next/navigation"
import { BarChart3, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { auth } from "@/lib/auth"
import { isAdmin, hentSystemSetting, standardModell } from "@/lib/admin"
import { hentPriser } from "@/lib/bruk-priser"
import { hentMaanedsstatistikk, naboMaaned, tolkMaaned } from "@/lib/bruk-statistikk"
import { BrukPriserSkjema } from "@/components/admin/bruk-priser-skjema"
import { Separator } from "@/components/ui/separator"

const FUNKSJON_NAVN: Record<string, string> = {
  notat: "Notatgenerering",
  chat: "Chat i konsultasjon",
  aihjelp: "AI-hjelp",
  promptbygger: "Lag prompt med AI",
  transkribering: "Opptak (transkribering)",
  diktering: "Diktering i tekstfelt",
}

export default async function AdminBrukSide({ searchParams }: { searchParams: Promise<{ mnd?: string }> }) {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) redirect("/innstillinger")

  const mnd = tolkMaaned((await searchParams).mnd)
  const [{ brukere, funksjoner }, priser, modell] = await Promise.all([
    hentMaanedsstatistikk(mnd),
    hentPriser(),
    hentSystemSetting("bedrock_model", standardModell()),
  ])

  const tall = (n: number, des = 0) => n.toLocaleString("nb-NO", { minimumFractionDigits: des, maximumFractionDigits: des })
  const kr = (usd: number) => `${tall(usd * priser.usdNok, 2)} kr`
  const sum = brukere.reduce(
    (s, b) => ({
      aiKall: s.aiKall + b.aiKall, inputTokens: s.inputTokens + b.inputTokens, outputTokens: s.outputTokens + b.outputTokens,
      ai: s.ai + b.aiKostnadUsd, opptak: s.opptak + b.opptak, lydTimer: s.lydTimer + b.lydTimer,
      antallTegn: s.antallTegn + b.antallTegn, soniox: s.soniox + b.sonioxKostnadUsd, total: s.total + b.sumUsd,
    }),
    { aiKall: 0, inputTokens: 0, outputTokens: 0, ai: 0, opptak: 0, lydTimer: 0, antallTegn: 0, soniox: 0, total: 0 }
  )
  const maanedNavn = new Date(`${mnd}-15T12:00:00Z`).toLocaleDateString("nb-NO", { month: "long", year: "numeric" })
  const th = "px-3 py-2 font-medium text-right whitespace-nowrap"
  const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap"

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-slate-800">Bruk og kostnader</h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Forbruk per bruker, rapportert av nettleseren etter hvert AI-kall og hvert opptak. Bare tall
            lagres, aldri innhold. Kostnaden er et estimat ut fra prisene nederst — avstem mot fakturaene
            fra AWS og Soniox.
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/admin/bruk?mnd=${naboMaaned(mnd, -1)}`} className="p-1.5 rounded hover:bg-slate-100" aria-label="Forrige måned">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="font-medium text-slate-700 w-36 text-center capitalize">{maanedNavn}</span>
          <Link href={`/admin/bruk?mnd=${naboMaaned(mnd, 1)}`} className="p-1.5 rounded hover:bg-slate-100" aria-label="Neste måned">
            <ChevronRight className="w-4 h-4" />
          </Link>
          <a href={`/api/admin/bruk/csv?mnd=${mnd}`} className="ml-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
            <Download className="w-3.5 h-3.5" /> CSV
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium text-left">Bruker</th>
              <th className={th}>AI-kall</th>
              <th className={th}>Tokens inn</th>
              <th className={th}>Tokens ut</th>
              <th className={th}>Claude</th>
              <th className={th}>Opptak</th>
              <th className={th}>Lydtimer</th>
              <th className={th}>Tegn</th>
              <th className={th}>Soniox</th>
              <th className={th}>Sum</th>
            </tr>
          </thead>
          <tbody>
            {brukere.map((b) => (
              <tr key={b.userId} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{b.navn}</div>
                  <div className="text-xs text-slate-400">{b.epost}</div>
                </td>
                <td className={td}>{tall(b.aiKall)}</td>
                <td className={td}>{tall(b.inputTokens)}</td>
                <td className={td}>{tall(b.outputTokens)}</td>
                <td className={td}>{kr(b.aiKostnadUsd)}</td>
                <td className={td}>{tall(b.opptak)}</td>
                <td className={td}>{tall(b.lydTimer, 2)}</td>
                <td className={td}>{tall(b.antallTegn)}</td>
                <td className={td}>{kr(b.sonioxKostnadUsd)}</td>
                <td className={`${td} font-semibold text-slate-800`}>{kr(b.sumUsd)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
            <tr>
              <td className="px-3 py-2">Totalt</td>
              <td className={td}>{tall(sum.aiKall)}</td>
              <td className={td}>{tall(sum.inputTokens)}</td>
              <td className={td}>{tall(sum.outputTokens)}</td>
              <td className={td}>{kr(sum.ai)}</td>
              <td className={td}>{tall(sum.opptak)}</td>
              <td className={td}>{tall(sum.lydTimer, 2)}</td>
              <td className={td}>{tall(sum.antallTegn)}</td>
              <td className={td}>{kr(sum.soniox)}</td>
              <td className={td}>{kr(sum.total)} <span className="text-xs font-normal text-slate-400">({tall(sum.total, 2)} USD)</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {funksjoner.length > 0 && (
        <div className="max-w-xl rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium text-left">Funksjon</th>
                <th className={th}>Antall</th>
                <th className={th}>Kostnad</th>
              </tr>
            </thead>
            <tbody>
              {funksjoner.map((f) => (
                <tr key={`${f.tjeneste}-${f.funksjon}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{FUNKSJON_NAVN[f.funksjon] ?? f.funksjon}</td>
                  <td className={td}>{tall(f.antall)}</td>
                  <td className={td}>{kr(f.kostnadUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Separator />

      <section className="space-y-3 max-w-3xl">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Priser</h2>
        <BrukPriserSkjema
          modell={modell}
          pris={priser.bedrock[modell] ?? priser.bedrockStandard}
          sonioxPerTime={priser.sonioxPerTime}
          usdNok={priser.usdNok}
        />
      </section>
    </div>
  )
}
