import Link from "next/link"
import type { Metadata } from "next"
import { ShieldCheck, Lock, Server, FileText } from "lucide-react"
import { hentGjeldendeDpa } from "@/lib/dpa"
import { Markdown } from "@/components/dpa/markdown"

export const metadata: Metadata = {
  title: "Databehandleravtale og sikkerhet – legeassist",
}

function Seksjon({
  id,
  tittel,
  children,
}: {
  id: string
  tittel: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1">
        {tittel}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

function Detalj({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
      <summary className="cursor-pointer list-none font-medium text-slate-700 marker:content-none flex items-center justify-between">
        <span>{tittel}</span>
        <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </details>
  )
}

export default async function DatabehandleravtalePage() {
  const gjeldende = await hentGjeldendeDpa()
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toppbar */}
      <header className="h-12 border-b border-slate-200 bg-white flex items-center px-5 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">LA</span>
          </div>
          <span className="font-semibold text-slate-800 text-sm">legeassist</span>
        </Link>
        <span className="ml-3 text-xs text-slate-400">
          Databehandleravtale og sikkerhet
        </span>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* Tittel */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-slate-900">
              Databehandleravtale og sikkerhetsinformasjon
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Versjon {gjeldende.versjon}
            {gjeldende.publisertAt
              ? ` · Sist oppdatert ${gjeldende.publisertAt.toLocaleDateString("nb-NO", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}`
              : ""}
          </p>
        </div>

        {/* Kort oppsummering */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" /> Kort fortalt
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Du (legen/klinikken) er <strong>behandlingsansvarlig</strong> for
            pasientopplysningene. legeassist er <strong>databehandler</strong> og
            behandler opplysninger kun på dine instrukser, for å transkribere
            konsultasjoner og generere journaldokumenter. Avtalen regulerer hva
            som behandles, hvordan det sikres, hvilke underleverandører som brukes,
            og dine og pasientenes rettigheter etter personvernforordningen (GDPR)
            og Normen for informasjonssikkerhet i helse- og omsorgssektoren.
          </p>
        </div>

        {/* ───────── Databehandleravtale (gjeldende versjon fra DB) ───────── */}
        <section id="avtale" className="scroll-mt-20">
          <Markdown>{gjeldende.innhold}</Markdown>
        </section>

        {/* ───────── Sikkerhet & samsvar ───────── */}
        <Seksjon id="samsvar" tittel="Slik oppfylles GDPR og Normen">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-1">
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <Lock className="w-4 h-4 text-blue-600" /> GDPR
              </div>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>Art. 5: dataminimering og lagringsbegrensning</li>
                <li>Art. 9: vern av helseopplysninger</li>
                <li>Art. 25: innebygd personvern</li>
                <li>Art. 28: databehandleravtale</li>
                <li>Art. 32: tekniske/organisatoriske tiltak</li>
                <li>Art. 44–49: ingen tredjelandsoverføring</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-1">
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <ShieldCheck className="w-4 h-4 text-blue-600" /> Normen
              </div>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>Tilgangsstyring og autentisering (2FA)</li>
                <li>Konfidensialitet, integritet, tilgjengelighet</li>
                <li>Logging uten pasientinnhold</li>
                <li>Sikkerhetsrevisjon og avvikshåndtering</li>
                <li>Risikovurdering (ROS) – se under</li>
              </ul>
            </div>
          </div>
        </Seksjon>

        {/* ───────── ROS-analyse ───────── */}
        <Seksjon id="ros" tittel="ROS-analyse (risiko- og sårbarhetsvurdering)">
          <p>
            Forenklet vurdering av sentrale risikoer. Sannsynlighet (S) og
            konsekvens (K) er angitt som Lav/Middels/Høy.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Scenario</th>
                  <th className="px-3 py-2 font-medium">S</th>
                  <th className="px-3 py-2 font-medium">K</th>
                  <th className="px-3 py-2 font-medium">Tiltak</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 align-top">
                {[
                  ["Avlytting av data under overføring", "Lav", "Høy", "TLS/WSS på all trafikk; ingen ukryptert transport"],
                  ["Uautorisert innlogging", "Middels", "Høy", "Sterke passord, obligatorisk 2FA, passkeys, admin-styrt kontoopprettelse"],
                  ["Lekkasje fra applikasjonsserveren", "Lav", "Middels", "Pasientinnhold lagres ikke på serveren; logger uten innhold"],
                  ["Lekkasje hos underdatabehandler", "Lav", "Høy", "EU-leverandører med DPA; ingen modelltrening på data"],
                  ["Pasientinnhold ligger igjen lokalt", "Middels", "Middels", "IndexedDB med automatisk tidsbegrenset sletting"],
                  ["Tredjelandsoverføring ved feilkonfig", "Lav", "Høy", "Kun eu.-modeller og EU-regioner tillatt"],
                  ["Tap av tilgjengelighet (nedetid)", "Middels", "Lav", "Selvhostet drift; rutinemessig overvåking"],
                ].map(([s, sann, kons, tiltak]) => (
                  <tr key={s} className="border-t border-slate-200">
                    <td className="px-3 py-2">{s}</td>
                    <td className="px-3 py-2">{sann}</td>
                    <td className="px-3 py-2">{kons}</td>
                    <td className="px-3 py-2">{tiltak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seksjon>

        {/* ───────── Tekniske detaljer ───────── */}
        <Seksjon id="teknisk" tittel="Tekniske detaljer (for interesserte)">
          <div className="flex items-center gap-2 text-slate-500">
            <Server className="w-4 h-4" />
            <span className="text-sm">Klikk for å utvide.</span>
          </div>

          <Detalj tittel="Dataflyt og arkitektur">
            <p>
              Pasientinnhold går direkte mellom klinikkens nettleser og
              tredjepartstjenestene. Serveren er en stateless proxy for
              notatgenerering og er ikke selv databehandler av pasientinnhold utover
              gjennomstrømming.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Nettleser → Soniox EU-endepunkt: lyd → sanntidstranskript.</li>
              <li>Nettleser → server → AWS Bedrock: transkript + prompt → notat (SSE-strøm).</li>
              <li>Server: kun brukerkontoer, maler og kortlivede tokens.</li>
            </ul>
          </Detalj>

          <Detalj tittel="Transkripsjon (Soniox)">
            <ul className="list-disc list-inside space-y-1">
              <li>EU-endepunkt for tale-til-tekst i sanntid.</li>
              <li>Serveren genererer kun kortlivede tokens (~60 sek, sesjonsspesifikke); API-nøkkelen forlater aldri serveren.</li>
              <li>Lyd strømmes – ingen lydfiler lagres.</li>
            </ul>
          </Detalj>

          <Detalj tittel="Tekstgenerering (AWS Bedrock / Claude)">
            <ul className="list-disc list-inside space-y-1">
              <li>EU-region (Frankfurt/Irland) med <code>eu.</code>-prefiks modeller.</li>
              <li>AWS Bedrock bruker ikke kundedata til modelltrening.</li>
              <li>Notat strømmes tilbake til nettleser via server-sent events.</li>
            </ul>
          </Detalj>

          <Detalj tittel="Lagring og levetid">
            <ul className="list-disc list-inside space-y-1">
              <li>Transkript/notater: IndexedDB i nettleseren med tidsbegrenset levetid.</li>
              <li>Database (server): kun brukere, maler og systeminnstillinger.</li>
              <li>Ingen pasientinnhold i serverlogger.</li>
            </ul>
          </Detalj>

          <Detalj tittel="Tilgang og autentisering">
            <ul className="list-disc list-inside space-y-1">
              <li>Kontoer opprettes kun av administrator; bruker setter eget passord via engangslenke.</li>
              <li>Passord lagres som bcrypt-hash; 2FA-hemmeligheter krypteres (AES-256-GCM).</li>
              <li>Tofaktor (TOTP) er obligatorisk for alle, med gjenopprettingskoder som reserve.</li>
              <li>
                Innlogging med passkey (WebAuthn) som alternativ: krever biometri eller PIN, er bundet til
                domenet og kan ikke fiskes. Serveren lagrer bare den offentlige nøkkelen.
              </li>
            </ul>
          </Detalj>
        </Seksjon>

        <footer className="pt-6 border-t border-slate-200 text-sm text-slate-500">
          <p>
            Spørsmål om personvern og sikkerhet rettes til{" "}
            <a href="mailto:ragnar@lilletorget.org" className="text-blue-600 hover:underline">
              ragnar@lilletorget.org
            </a>
            .
          </p>
        </footer>
      </article>
    </div>
  )
}
