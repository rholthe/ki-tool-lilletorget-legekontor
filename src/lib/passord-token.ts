import "server-only"
import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/db"

const GYLDIGHET_MS = 7 * 24 * 60 * 60 * 1000 // 7 dager

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Oppretter (eller erstatter) et passordoppsett-token for en bruker.
 * Returnerer klartekst-tokenet som skal sendes i e-postlenken — det lagres aldri.
 */
export async function lagPassordOppsettToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url")
  const tokenHash = hashToken(token)
  const expires = new Date(Date.now() + GYLDIGHET_MS)

  await prisma.passwordSetupToken.upsert({
    where: { userId },
    create: { userId, tokenHash, expires },
    update: { tokenHash, expires, createdAt: new Date() },
  })

  return token
}

/** Slår opp et gyldig token og returnerer bruker, eller null hvis ugyldig/utløpt. */
export async function finnBrukerForToken(
  token: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!token) return null
  const rad = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  if (!rad) return null
  if (rad.expires < new Date()) return null
  return rad.user
}

/** Sletter tokenet etter at passordet er satt. */
export async function forbrukToken(userId: string): Promise<void> {
  await prisma.passwordSetupToken.deleteMany({ where: { userId } })
}
