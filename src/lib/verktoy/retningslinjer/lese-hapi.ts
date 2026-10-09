import type { HapiNestetKapittel, HapiNestetTre, HapiNode } from "../../hapi/hent"
import { avkod, tilMarkdown } from "../../hapi/markdown"
import type { LeseEnhet, LeseKapittel, LeseRetningslinje } from "../typer"

/**
 * Nasjonale faglige retningslinjer fra Helsedirektoratets API (NLOD), til
 * oppslag i leseren. Ren funksjon, så den kan testes uten nettverk.
 *
 * Alt vises ordrett. Vi henter ut feltene fra kilden og gjør HTML om til
 * Markdown — ingenting oppsummeres eller omformuleres.
 */

/** Økes når oversettingen endres, så mellomlagrede data bygges på nytt. */
export const LESE_FORMAT = 1

/**
 * Kapitler som handler om hvordan retningslinjen er laget eller om koding i
 * spesialisthelsetjenesten, ikke om pasienten foran fastlegen.
 */
const UTELATTE_KAPITLER = new Set(["Metode og prosess", "Om retningslinjen", "Om pakkeforløpet", "Referanser"])
const UTELATTE_MONSTER = /^Registrering av koder/i

function utelatt(tittel: string): boolean {
  return UTELATTE_KAPITLER.has(tittel) || UTELATTE_MONSTER.test(tittel)
}

/** Kildens felt for begrunnelsen, i den rekkefølgen Helsedirektoratet viser dem. */
const BEGRUNNELSE: [string, string][] = [
  ["fordelerogulemper", "Fordeler og ulemper"],
  ["kvalitetdokumentasjon", "Kvalitet på dokumentasjonen"],
  ["verdierogpreferanser", "Verdier og preferanser"],
  ["ressurshensyn", "Ressurshensyn"],
]

function byggEnhet(node: HapiNode): LeseEnhet {
  const data = node.data ?? {}
  const deler: string[] = []
  for (const [felt, overskrift] of BEGRUNNELSE) {
    const md = tilMarkdown(data.nokkelInfo?.[felt])
    if (md) deler.push(`**${overskrift}**\n\n${md}`)
  }
  const rasjonale = tilMarkdown(data.rasjonale)
  if (rasjonale) deler.push(`**Rasjonale**\n\n${rasjonale}`)

  const styrke = typeof data.styrke === "string" ? avkod(data.styrke) : ""
  return {
    id: node.tekniskeData.infoId,
    tittel: avkod(node.tittel),
    styrke: styrke || undefined,
    url: node.url ?? "",
    sistFagligOppdatert: node.sistFagligOppdatert ?? "",
    tekst: tilMarkdown(node.tekst),
    praktisk: tilMarkdown(data.praktisk) || undefined,
    begrunnelse: deler.length > 0 ? deler.join("\n\n") : undefined,
  }
}

function byggKapittel(k: HapiNestetKapittel): LeseKapittel {
  const id = k.node.tekniskeData.infoId
  const tittel = avkod(k.node.tittel)
  const url = k.node.url ?? ""
  const tekst = tilMarkdown(k.node.tekst)
  const enheter = k.enheter.map(byggEnhet)
  if (tekst) {
    enheter.unshift({
      id,
      tittel,
      erKapitteltekst: true,
      url,
      sistFagligOppdatert: k.node.sistFagligOppdatert ?? "",
      tekst,
    })
  }
  return {
    id,
    tittel,
    url,
    kapitler: k.kapitler.filter((u) => !utelatt(avkod(u.node.tittel))).map(byggKapittel),
    enheter,
  }
}

/** Kildens lenker til API-et krever nøkkel — pek dem til helsedirektoratet.no. */
function omskrivLenker(r: LeseRetningslinje): void {
  const url = new Map<string, string>()
  const samle = (kapitler: LeseKapittel[]) => {
    for (const k of kapitler) {
      url.set(k.id, k.url)
      for (const e of k.enheter) url.set(e.id, e.url)
      samle(k.kapitler)
    }
  }
  samle(r.kapitler)
  for (const e of r.enheter) url.set(e.id, e.url)

  const omskriv = (md: string | undefined) =>
    md?.replace(/\]\((https?:\/\/api(?:-qa)?\.helsedirektoratet\.no\/[^)\s]*)\)/g, (_m, href: string) => {
      const infoId = href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)?.[0]
      return `](${(infoId && url.get(infoId)) || r.url || "https://www.helsedirektoratet.no"})`
    })
  const gaa = (kapitler: LeseKapittel[]) => {
    for (const k of kapitler) {
      for (const e of k.enheter) {
        e.tekst = omskriv(e.tekst)
        e.praktisk = omskriv(e.praktisk)
        e.begrunnelse = omskriv(e.begrunnelse)
      }
      gaa(k.kapitler)
    }
  }
  gaa(r.kapitler)
}

export function byggLeseRetningslinje(tre: HapiNestetTre, hentetAt: string): LeseRetningslinje {
  const r: LeseRetningslinje = {
    id: tre.rot.tekniskeData.infoId,
    kategori: "leseretningslinje",
    ...(tre.rot.tekniskeData.infoType === "nasjonalt-forlop" ? { art: "forlop" as const } : {}),
    navn: avkod(tre.rot.tittel),
    kortNavn: avkod((tre.rot as HapiNode & { kortTittel?: string }).kortTittel || tre.rot.tittel),
    url: tre.rot.url ?? "",
    sistFagligOppdatert: tre.rot.sistFagligOppdatert ?? "",
    hentetAt,
    kapitler: tre.kapitler
      .filter((k) => !utelatt(avkod(k.node.tittel)))
      .map(byggKapittel),
    enheter: tre.enheter.map(byggEnhet),
  }
  omskrivLenker(r)
  return r
}

/** Antall enheter totalt — en retningslinje uten enheter finnes bare som PDF hos kilden. */
export function antallEnheter(r: LeseRetningslinje): number {
  const tell = (kapitler: LeseKapittel[]): number =>
    kapitler.reduce((n, k) => n + k.enheter.length + tell(k.kapitler), 0)
  return r.enheter.length + tell(r.kapitler)
}

/**
 * Innholdsfortegnelsen: samme struktur uten brødtekst. Det er dette nettleseren
 * får i listen og bruker til søk; teksten hentes når retningslinjen åpnes.
 */
export function tilIndeks(r: LeseRetningslinje): LeseRetningslinje {
  const enhet = (e: LeseEnhet): LeseEnhet => ({
    id: e.id,
    tittel: e.tittel,
    erKapitteltekst: e.erKapitteltekst,
    styrke: e.styrke,
    url: e.url,
    sistFagligOppdatert: e.sistFagligOppdatert,
  })
  const kapittel = (k: LeseKapittel): LeseKapittel => ({
    id: k.id,
    tittel: k.tittel,
    url: k.url,
    kapitler: k.kapitler.map(kapittel),
    enheter: k.enheter.map(enhet),
  })
  return { ...r, kapitler: r.kapitler.map(kapittel), enheter: r.enheter.map(enhet) }
}
