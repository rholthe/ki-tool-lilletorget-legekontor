"use server"

import bcrypt from "bcryptjs"
import speakeasy from "speakeasy"
import qrcode from "qrcode"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { encrypt, decrypt } from "@/lib/crypto"
import { erKrav2faAktivt } from "@/lib/to-faktor-krav"
import { antallUbrukte, lagNyeKoder, slettKoder } from "@/lib/gjenoppretting"

export async function generer2FAHemmelighet(): Promise<
  { qrUrl: string; manuellKode: string } | { feil: string }
> {
  const session = await auth()
  if (!session?.user?.id) return { feil: "Ikke autentisert" }

  const bruker = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!bruker) return { feil: "Bruker ikke funnet" }
  if (bruker.twoFactorEnabled) return { feil: "2FA er allerede aktivert" }

  const secret = speakeasy.generateSecret({
    name: `legeassist:${bruker.email}`,
    issuer: "legeassist",
    length: 20,
  })

  // Lagre kryptert hemmelighet (ikke aktivert ennå)
  await prisma.user.update({
    where: { id: bruker.id },
    data: { twoFactorSecret: encrypt(secret.base32) },
  })

  const qrUrl = await qrcode.toDataURL(secret.otpauth_url!)

  return {
    qrUrl,
    manuellKode: secret.base32,
  }
}

/** Aktiverer 2FA og lager ti gjenopprettingskoder, som vises brukeren én gang. */
export async function bekreft2FA(
  token: string
): Promise<{ suksess: true; koder: string[] } | { feil: string }> {
  const session = await auth()
  if (!session?.user?.id) return { feil: "Ikke autentisert" }

  const bruker = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!bruker?.twoFactorSecret) return { feil: "Ingen hemmelighet funnet" }

  const secret = decrypt(bruker.twoFactorSecret)
  const ok = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: token.replace(/\s/g, ""),
    window: 1,
  })

  if (!ok) return { feil: "Ugyldig kode — prøv igjen" }

  await prisma.user.update({
    where: { id: bruker.id },
    data: { twoFactorEnabled: true },
  })

  return { suksess: true, koder: await lagNyeKoder(bruker.id) }
}

/**
 * Nye gjenopprettingskoder (de gamle slutter å virke). Krever en gyldig kode fra
 * appen: en som bare har overtatt en innlogget økt, skal ikke kunne lage seg
 * en vei inn igjen.
 */
export async function lagNyeGjenopprettingskoder(
  token: string
): Promise<{ koder: string[] } | { feil: string }> {
  const session = await auth()
  if (!session?.user?.id) return { feil: "Ikke autentisert" }

  const bruker = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!bruker?.twoFactorEnabled || !bruker.twoFactorSecret) {
    return { feil: "To-faktor er ikke aktivert" }
  }
  const ok = speakeasy.totp.verify({
    secret: decrypt(bruker.twoFactorSecret),
    encoding: "base32",
    token: token.replace(/\s/g, ""),
    window: 1,
  })
  if (!ok) return { feil: "Ugyldig kode fra appen — prøv igjen" }

  return { koder: await lagNyeKoder(bruker.id) }
}

export async function deaktiver2FA(
  passord: string
): Promise<{ suksess: true } | { feil: string }> {
  const session = await auth()
  if (!session?.user?.id) return { feil: "Ikke autentisert" }

  const bruker = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!bruker?.passwordHash) return { feil: "Bruker ikke funnet" }

  const passordOk = await bcrypt.compare(passord, bruker.passwordHash)
  if (!passordOk) return { feil: "Feil passord" }

  if (await erKrav2faAktivt()) {
    return { feil: "To-faktor er obligatorisk og kan ikke slås av." }
  }

  await prisma.user.update({
    where: { id: bruker.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  })
  await slettKoder(bruker.id)

  return { suksess: true }
}

export async function hent2FAStatus(): Promise<{
  aktivert: boolean
  epost: string
  ubrukteKoder: number
}> {
  const session = await auth()
  if (!session?.user?.id) return { aktivert: false, epost: "", ubrukteKoder: 0 }

  const bruker = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, email: true },
  })

  return {
    aktivert: bruker?.twoFactorEnabled ?? false,
    epost: bruker?.email ?? "",
    ubrukteKoder: bruker?.twoFactorEnabled ? await antallUbrukte(session.user.id) : 0,
  }
}
