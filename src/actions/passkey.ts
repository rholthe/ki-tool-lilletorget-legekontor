"use server"

import { headers } from "next/headers"
import speakeasy from "speakeasy"
import type { RegistrationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import { hentPasskeys, lagInnloggingsvalg, lagRegistreringsvalg, lagrePasskey, type PasskeyInfo } from "@/lib/passkey"
import { varsleNyPasskey } from "@/lib/to-faktor-varsel"

/** Utfordringer fra innloggingssiden, per IP siste time. I minnet: én serverprosess. */
const forsok = new Map<string, number[]>()
const VINDU_MS = 60 * 60 * 1000
// Siden ber om en utfordring hver gang den lastes (autoutfylling); en klinikk deler IP
const MAKS_PER_IP = 200

function forMange(ip: string): boolean {
  const naa = Date.now()
  const liste = (forsok.get(ip) ?? []).filter((t) => naa - t < VINDU_MS)
  liste.push(naa)
  forsok.set(ip, liste)
  return liste.length > MAKS_PER_IP
}

/** Offentlig: utfordring til «Logg inn med passkey» og autoutfylling i e-postfeltet. */
export async function startPasskeyInnlogging(): Promise<
  { utfordringId: string; valg: PublicKeyCredentialRequestOptionsJSON } | { feil: string }
> {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "ukjent"
  if (forMange(ip)) return { feil: "For mange forsøk. Vent litt og prøv igjen." }
  return lagInnloggingsvalg()
}

/**
 * Første steg når en passkey legges til. Krever en gyldig kode fra
 * autentiseringsappen: en som bare har overtatt en innlogget økt, skal ikke
 * kunne lage seg en egen vei inn.
 */
export async function startPasskeyRegistrering(
  totp: string
): Promise<{ utfordringId: string; valg: PublicKeyCredentialCreationOptionsJSON } | { feil: string }> {
  const session = await auth()
  if (!session?.user?.id) return { feil: "Ikke autentisert" }

  const bruker = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!bruker?.twoFactorEnabled || !bruker.twoFactorSecret) {
    return { feil: "Aktiver to-faktor før du legger til en passkey." }
  }
  const ok = speakeasy.totp.verify({
    secret: decrypt(bruker.twoFactorSecret),
    encoding: "base32",
    token: totp.replace(/\s/g, ""),
    window: 1,
  })
  if (!ok) return { feil: "Ugyldig kode fra appen — prøv igjen" }

  return lagRegistreringsvalg(bruker)
}

export async function fullforPasskeyRegistrering(
  utfordringId: string,
  svar: RegistrationResponseJSON,
  navn: string
): Promise<{ passkeys: PasskeyInfo[] } | { feil: string }> {
  const session = await auth()
  if (!session?.user?.id) return { feil: "Ikke autentisert" }

  const rentNavn = navn.trim().slice(0, 100) || "Passkey"
  const res = await lagrePasskey(session.user.id, utfordringId, svar, rentNavn)
  if (!res.ok) return { feil: res.feil }

  const bruker = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  })
  if (bruker) void varsleNyPasskey(bruker, rentNavn)
  console.info(`[passkey] lagt til for bruker ${session.user.id}`)

  return { passkeys: await hentPasskeys(session.user.id) }
}

export async function slettPasskey(id: string): Promise<{ passkeys: PasskeyInfo[] } | { feil: string }> {
  const session = await auth()
  if (!session?.user?.id) return { feil: "Ikke autentisert" }

  // Bare egne passkeys
  const { count } = await prisma.passkey.deleteMany({ where: { id, userId: session.user.id } })
  if (count === 0) return { feil: "Fant ikke passkeyen" }
  console.info(`[passkey] slettet for bruker ${session.user.id}`)

  return { passkeys: await hentPasskeys(session.user.id) }
}
