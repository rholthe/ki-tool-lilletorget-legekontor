import "server-only"
import { prisma } from "@/lib/db"

// ─── Baseline (brukes før admin har opprettet en versjon i databasen) ────────

export const BASELINE_DPA_VERSJON = "1.0"

export const BASELINE_DPA_INNHOLD = `## 1. Parter

**Behandlingsansvarlig:** den lege/klinikk som oppretter og bruker en brukerkonto i tjenesten.

**Databehandler:** legeassist, levert av Ragnar Holthe / lilletorget.org. Databehandler stiller programvaren til rådighet og behandler personopplysninger på vegne av behandlingsansvarlig.

## 2. Formål og behandlingens art

Behandlingen skjer utelukkende for å levere tjenestens funksjonalitet: sanntidstranskribering av tale, og generering av journalnotater og andre kliniske dokumenter ut fra transkript og kontekst legen oppgir. Databehandler behandler ikke opplysningene til egne formål, og bruker dem aldri til å trene KI-modeller.

## 3. Kategorier opplysninger og registrerte

- **Registrerte:** pasienter i konsultasjon med legen, samt brukeren (legen) selv.
- **Særlige kategorier (art. 9):** helseopplysninger i tale, transkript, kontekst, vedlegg og genererte notater.
- **Alminnelige opplysninger:** brukerkonto (navn, e-post), innloggingsdata og preferanser.

## 4. Databehandlers plikter

- Behandle personopplysninger kun etter dokumenterte instrukser fra behandlingsansvarlig.
- Sikre at alle med tilgang har taushetsplikt og kun behandler det som er nødvendig.
- Gjennomføre egnede tekniske og organisatoriske tiltak (art. 32).
- Bistå behandlingsansvarlig med å oppfylle pasientenes rettigheter og varslingsplikter.
- Ikke benytte underdatabehandlere uten at disse er underlagt tilsvarende plikter.
- Slette eller returnere opplysninger ved avtalens opphør.

## 5. Sikkerhetstiltak (GDPR art. 32)

Tjenesten er bygget etter prinsippet *privacy by design*: pasientinnhold behandles direkte mellom nettleseren og spesialiserte tredjepartstjenester, og lagres ikke varig på applikasjonsserveren.

- All trafikk er kryptert med TLS (HTTPS/WSS).
- Lydopptak lagres aldri – lyd strømmes direkte til transkripsjon.
- Transkript og notater holdes i nettlesersesjonen (IndexedDB med tidsbegrenset levetid).
- Tofaktorautentisering (TOTP) tilgjengelig og anbefalt for alle brukere.
- Selvregistrering er deaktivert; kun administrator oppretter kontoer.
- Serverlogger inneholder ikke pasientinnhold.

## 6. Underdatabehandlere

Følgende underdatabehandlere benyttes, alle med databehandling innenfor EU/EØS:

| Leverandør | Formål | Lokasjon |
| --- | --- | --- |
| Soniox | Sanntidstranskribering av tale | EU-endepunkt |
| AWS Bedrock (Anthropic Claude) | Generering av notater og dokumenter | EU (Frankfurt/Irland) |
| Selvhostet VPS (EU) | Autentisering, maler, proxy | EU |

Det skjer ingen overføring av personopplysninger til tredjeland utenfor EU/EØS.

## 7. Pasientenes rettigheter og bistand

Databehandler bistår behandlingsansvarlig med å besvare henvendelser om innsyn, retting og sletting, samt med personvernkonsekvensvurderinger (DPIA) og kontakt med tilsynsmyndighet ved behov.

## 8. Håndtering av brudd på personopplysningssikkerheten

Databehandler varsler behandlingsansvarlig uten ugrunnet opphold etter å ha blitt kjent med et brudd, og bistår med informasjon som er nødvendig for behandlingsansvarliges melding til Datatilsynet (innen 72 timer) og til berørte registrerte.

## 9. Lagring, sletting og dataminimering

Det lagres ikke lydopptak. Transkript og notater beholdes kun i nettlesersesjonen og slettes automatisk etter en tidsbegrenset levetid. Brukerkonto med tilhørende maler slettes ved avtalens opphør eller på forespørsel.

## 10. Revisjon, varighet og endringer

Behandlingsansvarlig kan be om dokumentasjon som viser at pliktene etterleves. Avtalen gjelder så lenge brukerkontoen er aktiv. Ved vesentlige endringer i avtalen oppdateres versjonsnummeret, og brukeren må signere på nytt før videre bruk.`

// ─── Typer ───────────────────────────────────────────────────────────────────

export interface GjeldendeDpa {
  versjon: string
  innhold: string
  publisertAt: Date | null
}

export interface DpaSignatur {
  dpaSignedAt: Date | null
  dpaVersion: string | null
}

// ─── DB-resolvere ─────────────────────────────────────────────────────────────

/** Gjeldende (aktive) DPA. Faller tilbake til baseline hvis ingen finnes i DB. */
export async function hentGjeldendeDpa(): Promise<GjeldendeDpa> {
  const rad =
    (await prisma.dpaVersjon.findFirst({ where: { gjeldende: true } })) ??
    (await prisma.dpaVersjon.findFirst({ orderBy: { publisertAt: "desc" } }))

  if (!rad) {
    return { versjon: BASELINE_DPA_VERSJON, innhold: BASELINE_DPA_INNHOLD, publisertAt: null }
  }
  return { versjon: rad.versjon, innhold: rad.innhold, publisertAt: rad.publisertAt }
}

/**
 * Tidspunktet en signatur senest må være satt etter for å være gyldig =
 * publiseringstidspunktet for siste versjon merket «krev ny signering».
 * Null betyr at ingen slik versjon finnes (alle signaturer er gyldige).
 */
export async function kravSigneringEtter(): Promise<Date | null> {
  const rad = await prisma.dpaVersjon.findFirst({
    where: { krevNySignering: true },
    orderBy: { publisertAt: "desc" },
    select: { publisertAt: true },
  })
  return rad?.publisertAt ?? null
}

/** Har brukeren en gyldig signatur gitt eventuelle betydelige versjonsendringer? */
export async function harGyldigSignatur(
  bruker: DpaSignatur | null | undefined
): Promise<boolean> {
  if (!bruker?.dpaSignedAt) return false
  const kravFra = await kravSigneringEtter()
  if (!kravFra) return true
  return bruker.dpaSignedAt >= kravFra
}
