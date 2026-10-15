import "server-only"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server"
import { prisma } from "@/lib/db"
import { hentBasisUrl } from "@/lib/mail"

/**
 * Passkeys (WebAuthn) med SimpleWebAuthn, ikke Auth.js sin eksperimentelle
 * provider: innloggingen går gjennom vår egen Credentials-provider, så øktregler,
 * DPA-sperre og 2FA-krav gjelder uendret.
 *
 * - Brukerverifisering kreves (biometri/PIN) — da er én passkey fullverdig tofaktor.
 * - Passkeyen må ligge på enheten (`residentKey: "required"`), så innlogging
 *   skjer uten å oppgi e-post, og innloggingssiden avslører aldri om en adresse
 *   har konto.
 * - Alle typer godtas (Windows Hello, Bitwarden, iCloud/Google, YubiKey); ingen
 *   attestasjon.
 */

const RP_NAVN = "legeassist"
const REGISTRERING_GYLDIG_MS = 5 * 60 * 1000
// Innloggingssiden starter autoutfyllingen når den lastes, og kan bli stående åpen
const INNLOGGING_GYLDIG_MS = 15 * 60 * 1000

type Formaal = "registrering" | "innlogging"

/** rpID og origin fra APP_URL (prod: ki.lilletorget.org, dev: localhost). */
async function rp(): Promise<{ rpID: string; origin: string }> {
  const url = new URL(await hentBasisUrl())
  return { rpID: url.hostname, origin: url.origin }
}

async function lagreUtfordring(utfordring: string, formaal: Formaal, userId?: string): Promise<string> {
  await prisma.passkeyUtfordring.deleteMany({ where: { utloper: { lt: new Date() } } })
  const gyldig = formaal === "innlogging" ? INNLOGGING_GYLDIG_MS : REGISTRERING_GYLDIG_MS
  const rad = await prisma.passkeyUtfordring.create({
    data: { utfordring, formaal, userId, utloper: new Date(Date.now() + gyldig) },
  })
  return rad.id
}

/** Henter og sletter utfordringen (engangs). Null hvis ukjent, utløpt eller feil formål/bruker. */
async function brukUtfordring(id: string, formaal: Formaal, userId?: string): Promise<string | null> {
  const rad = await prisma.passkeyUtfordring.findUnique({ where: { id } })
  if (!rad) return null
  // Sletting som teller: to samtidige forsøk kan ikke bruke samme utfordring
  const { count } = await prisma.passkeyUtfordring.deleteMany({ where: { id } })
  if (count !== 1) return null
  if (rad.formaal !== formaal || rad.utloper < new Date()) return null
  if (userId !== undefined && rad.userId !== userId) return null
  return rad.utfordring
}

function tilTransports(t: string | null): string[] | undefined {
  return t ? t.split(",") : undefined
}

// ─── Registrering ────────────────────────────────────────────────────────────

export async function lagRegistreringsvalg(bruker: {
  id: string
  email: string
  name: string | null
}): Promise<{ utfordringId: string; valg: PublicKeyCredentialCreationOptionsJSON }> {
  const { rpID } = await rp()
  const eksisterende = await prisma.passkey.findMany({
    where: { userId: bruker.id },
    select: { credentialId: true, transports: true },
  })
  const valg = await generateRegistrationOptions({
    rpName: RP_NAVN,
    rpID,
    userName: bruker.email,
    userDisplayName: bruker.name ?? bruker.email,
    userID: new TextEncoder().encode(bruker.id),
    timeout: REGISTRERING_GYLDIG_MS,
    attestationType: "none",
    // Samme enhet/nøkkel kan ikke registreres to ganger for samme konto
    excludeCredentials: eksisterende.map((p) => ({
      id: p.credentialId,
      transports: tilTransports(p.transports),
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  })
  const utfordringId = await lagreUtfordring(valg.challenge, "registrering", bruker.id)
  return { utfordringId, valg }
}

export async function lagrePasskey(
  userId: string,
  utfordringId: string,
  svar: RegistrationResponseJSON,
  navn: string
): Promise<{ ok: true; id: string } | { ok: false; feil: string }> {
  const utfordring = await brukUtfordring(utfordringId, "registrering", userId)
  if (!utfordring) return { ok: false, feil: "Forespørselen er utløpt. Prøv igjen." }

  const { rpID, origin } = await rp()
  let resultat
  try {
    resultat = await verifyRegistrationResponse({
      response: svar,
      expectedChallenge: utfordring,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })
  } catch {
    return { ok: false, feil: "Passkeyen kunne ikke verifiseres." }
  }
  if (!resultat.verified) return { ok: false, feil: "Passkeyen kunne ikke verifiseres." }

  const info = resultat.registrationInfo
  const finnes = await prisma.passkey.findUnique({ where: { credentialId: info.credential.id } })
  if (finnes) return { ok: false, feil: "Denne passkeyen er allerede registrert." }

  const rad = await prisma.passkey.create({
    data: {
      userId,
      credentialId: info.credential.id,
      publicKey: isoBase64URL.fromBuffer(info.credential.publicKey),
      counter: info.credential.counter,
      transports: info.credential.transports?.join(",") || null,
      flerEnhet: info.credentialDeviceType === "multiDevice",
      sikkerhetskopiert: info.credentialBackedUp,
      aaguid: info.aaguid,
      navn,
    },
  })
  return { ok: true, id: rad.id }
}

// ─── Innlogging ──────────────────────────────────────────────────────────────

export async function lagInnloggingsvalg(): Promise<{
  utfordringId: string
  valg: PublicKeyCredentialRequestOptionsJSON
}> {
  const { rpID } = await rp()
  // Ingen allowCredentials: nettleseren tilbyr passkeyene den har for nettstedet
  const valg = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    timeout: INNLOGGING_GYLDIG_MS,
  })
  const utfordringId = await lagreUtfordring(valg.challenge, "innlogging")
  return { utfordringId, valg }
}

/** Verifiserer en innlogging. Gir brukeren, eller null — årsaken avsløres ikke. */
export async function verifiserInnlogging(
  utfordringId: string,
  svar: AuthenticationResponseJSON
): Promise<{ id: string; email: string; name: string | null } | null> {
  const utfordring = await brukUtfordring(utfordringId, "innlogging")
  if (!utfordring) return null

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: svar.id },
    include: { user: { select: { id: true, email: true, name: true, passwordHash: true, twoFactorEnabled: true } } },
  })
  // Låste kontoer (venter på passord) og kontoer uten 2FA slipper ikke inn
  if (!passkey?.user.passwordHash || !passkey.user.twoFactorEnabled) return null

  const { rpID, origin } = await rp()
  let resultat
  try {
    resultat = await verifyAuthenticationResponse({
      response: svar,
      expectedChallenge: utfordring,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: isoBase64URL.toBuffer(passkey.publicKey),
        counter: passkey.counter,
        transports: tilTransports(passkey.transports),
      },
    })
  } catch {
    // Bl.a. telleren gikk bakover: tegn på en klonet nøkkel
    return null
  }
  if (!resultat.verified) return null

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: resultat.authenticationInfo.newCounter,
      sikkerhetskopiert: resultat.authenticationInfo.credentialBackedUp,
      sistBrukt: new Date(),
    },
  })
  const { id, email, name } = passkey.user
  return { id, email, name }
}

// ─── Oversikt og sletting ────────────────────────────────────────────────────

export type PasskeyInfo = {
  id: string
  navn: string
  flerEnhet: boolean
  opprettet: string
  sistBrukt: string | null
}

export async function hentPasskeys(userId: string): Promise<PasskeyInfo[]> {
  const rader = await prisma.passkey.findMany({
    where: { userId },
    orderBy: { opprettet: "asc" },
    select: { id: true, navn: true, flerEnhet: true, opprettet: true, sistBrukt: true },
  })
  return rader.map((r) => ({
    ...r,
    opprettet: r.opprettet.toISOString(),
    sistBrukt: r.sistBrukt?.toISOString() ?? null,
  }))
}

/** Når TOTP slås av eller nullstilles, forsvinner passkeyene også. */
export async function slettAllePasskeys(userId: string): Promise<number> {
  const { count } = await prisma.passkey.deleteMany({ where: { userId } })
  return count
}
