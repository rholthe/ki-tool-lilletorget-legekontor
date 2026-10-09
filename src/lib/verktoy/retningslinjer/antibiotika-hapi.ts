import type { HapiNode, HapiTre } from "../../hapi/hent"
import { avkod, tilMarkdown } from "../../hapi/markdown"
import type { Anbefaling, Retningslinje, Tilstand } from "../typer"
import {
  KAPITTEL_FAGOMRADE,
  RETNINGSLINJE_SOKEORD,
  TILSTAND_TILLEGG,
  UTELATTE_KAPITLER,
} from "./antibiotika-tillegg"

/**
 * Nasjonal faglig retningslinje for bruk av antibiotika i primærhelsetjenesten,
 * fra Helsedirektoratets API (NLOD).
 *
 * Retningslinjen har egen datamodell i API-et: hver tilstand har behandlinger med
 * strukturerte doseringsregimer. Vi bruker kildens egen visningstekst
 * (`displayOppsummering`) ordrett, og omformulerer ingenting. Den bygges av
 * Helsedirektoratet fra de strukturerte feltene og er mer presis enn tittelen:
 * «Azitromycin 10 mg/kg x 1 oral mikstur med ladningsdose fra dag 2» (tittel)
 * mot «Azitromycin oral 20 mg/kg x 1 ladningsdose etterfulgt av …» (visning).
 *
 * Ren funksjon uten nettverk, så selvtesten kan kjøre den på reservekopien.
 */

export const ANTIBIOTIKA_ID = "antibiotika-allmennpraksis"
export const ANTIBIOTIKA_ROT =
  "/innhold/retningslinjer/0006-0001-93580776-3de9-4c1a-83de-3f785ff4e861"

/**
 * Økes når oversettingen endres, så mellomlagrede data bygges på nytt i stedet
 * for å vises i gammel form.
 */
export const ANTIBIOTIKA_FORMAT = 1

/** Visningen har sin egen overskrift for indikasjonen; kildens første overskrift dupliserer den. */
function utenIndikasjonsoverskrift(md: string): string {
  return md.replace(/^#{1,6}\s*Indikasjon[^\n]*\n+/i, "").trim()
}

// Kun feltene vi leser fra antibiotikamodellen
interface Doseringsregime {
  id?: string
  tittel?: string
  data?: { displayOppsummering?: string | null }
}
interface Regimrad {
  overskrift?: string | null
  doseringregimer?: Doseringsregime[]
}
interface Behandling {
  overskrift?: string | null
  behandling?: {
    tekst?: string | null
    data?: {
      varighetBehandlingAntallDogn?: string | number | null
      standardbehandlingsregimer?: Regimrad[] | null
      alternativebehandlingsregimer?: Regimrad[] | null
    } | null
  }
}

function regimtekst(r: Doseringsregime): string {
  return avkod(r.data?.displayOppsummering || r.tittel || "")
}

function byggTilstand(enhet: HapiNode, kapittel: string): Tilstand {
  const behandlinger: Behandling[] = enhet.data?.behandlinger ?? []
  const anbefalinger: Anbefaling[] = []
  const merknader: string[] = []
  const brukteIder = new Set<string>()
  let varighet: string | undefined

  for (const b of behandlinger) {
    const data = b.behandling?.data
    const grupper: [Anbefaling["gruppe"], Regimrad[]][] = [
      ["standard", data?.standardbehandlingsregimer ?? []],
      ["alternativ", data?.alternativebehandlingsregimer ?? []],
    ]
    for (const [gruppe, rader] of grupper) {
      for (const rad of rader) {
        const regimer = (rad.doseringregimer ?? []).map(regimtekst).filter(Boolean)
        if (regimer.length === 0) continue
        let id = rad.doseringregimer?.[0]?.id || `${gruppe}-${anbefalinger.length}`
        // Samme regime kan stå i to rader (ulike etiketter) — id-en må likevel være unik
        while (brukteIder.has(id)) id = `${id}~`
        brukteIder.add(id)
        anbefalinger.push({
          id,
          etikett: avkod(rad.overskrift ?? "") || (gruppe === "standard" ? "Standardbehandling" : "Alternativ"),
          regimer,
          gruppe,
        })
      }
    }

    const dogn = data?.varighetBehandlingAntallDogn
    if (!varighet && dogn !== null && dogn !== undefined && String(dogn).trim()) {
      varighet = `${String(dogn).trim()} døgn`
    }

    const md = tilMarkdown(b.behandling?.tekst)
    if (md) merknader.push(b.overskrift ? `**${avkod(b.overskrift)}**\n\n${md}` : md)
  }

  const tillegg = TILSTAND_TILLEGG[enhet.tekniskeData.infoId] ?? {}
  return {
    id: enhet.tekniskeData.infoId,
    navn: avkod(enhet.tittel),
    kapittel,
    sokeord: tillegg.sokeord ?? [],
    fagomrader: tillegg.fagomrader ?? KAPITTEL_FAGOMRADE[kapittel] ?? ["akutt"],
    url: enhet.url ?? "",
    sistFagligOppdatert: enhet.sistFagligOppdatert ?? "",
    indikasjon: utenIndikasjonsoverskrift(tilMarkdown(enhet.tekst)),
    varighet,
    anbefalinger,
    merknader: merknader.length > 0 ? merknader.join("\n\n") : undefined,
  }
}

export function byggAntibiotika(tre: HapiTre, hentetAt: string): Retningslinje {
  const tilstander: Tilstand[] = []
  for (const k of tre.kapitler) {
    const kapittel = avkod(k.node.tittel)
    if (UTELATTE_KAPITLER.includes(kapittel)) continue
    for (const enhet of k.enheter) {
      if (enhet.tekniskeData.infoType !== "anbefaling") continue
      tilstander.push(byggTilstand(enhet, kapittel))
    }
  }

  // Kildens kryssreferanser peker til API-et, som krever nøkkel. Pek dem til
  // samme innhold på helsedirektoratet.no i stedet.
  const urlFor = new Map(tilstander.map((t) => [t.id, t.url]))
  const omskriv = (md: string) =>
    md.replace(/\]\((https?:\/\/api(?:-qa)?\.helsedirektoratet\.no\/[^)\s]*)\)/g, (_m, href: string) => {
      const infoId = href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)?.[0]
      return `](${(infoId && urlFor.get(infoId)) || tre.rot.url || "https://www.helsedirektoratet.no"})`
    })
  for (const t of tilstander) {
    t.indikasjon = omskriv(t.indikasjon)
    if (t.merknader) t.merknader = omskriv(t.merknader)
  }

  return {
    id: ANTIBIOTIKA_ID,
    navn: "Antibiotika i primærhelsetjenesten",
    kortNavn: "Antibiotika",
    langtNavn: avkod(tre.rot.tittel),
    kategori: "retningslinje",
    sokeord: RETNINGSLINJE_SOKEORD,
    kilde: {
      navn: "Helsedirektoratet",
      url: tre.rot.url ?? undefined,
      sistRevidert: tre.rot.sistFagligOppdatert ?? "",
    },
    url: tre.rot.url ?? "",
    tilstander,
    hentetAt,
  }
}
