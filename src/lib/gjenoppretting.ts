import "server-only"
import { createHmac, randomInt } from "crypto"
import { prisma } from "@/lib/db"

/**
 * Gjenopprettingskoder: engangskoder som erstatter koden fra autentiseringsappen
 * når telefonen er borte. Standard praksis (Google, GitHub), og bedre enn et
 * felles superpassord: hver kode virker én gang, er knyttet til én bruker, kan
 * byttes ut i Innstillinger, og brukeren varsles på e-post når en brukes.
 *
 * Kodene er 10 tegn fra et alfabet uten tegn som forveksles (0/O, 1/I/L, U/V),
 * ca. 49 bit. Bare HMAC-SHA256 med `TOTP_ENCRYPTION_KEY` lagres, så en lekket
 * database alene ikke holder til å prøve seg fram.
 */

export const ANTALL_KODER = 10
const ALFABET = "ABCDEFGHJKMNPQRSTWXYZ23456789"
const LENGDE = 10

function nokkel(): string {
  const k = process.env.TOTP_ENCRYPTION_KEY
  if (!k) throw new Error("TOTP_ENCRYPTION_KEY mangler")
  return k
}

/** Store bokstaver, uten bindestrek og mellomrom — slik legen gjerne limer inn. */
function normaliser(kode: string): string {
  return kode.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function hash(kode: string): string {
  return createHmac("sha256", nokkel()).update(normaliser(kode)).digest("hex")
}

/** Ser ut som en gjenopprettingskode (og ikke en sekssifret TOTP-kode). */
export function erGjenopprettingskode(kode: string): boolean {
  const n = normaliser(kode)
  return n.length === LENGDE && [...n].every((t) => ALFABET.includes(t))
}

function lagKode(): string {
  const tegn = Array.from({ length: LENGDE }, () => ALFABET[randomInt(ALFABET.length)]).join("")
  return `${tegn.slice(0, 5)}-${tegn.slice(5)}`
}

/** Erstatter brukerens koder med ti nye. Returnerer klarteksten — vis den én gang. */
export async function lagNyeKoder(userId: string): Promise<string[]> {
  const koder = Array.from({ length: ANTALL_KODER }, lagKode)
  await prisma.$transaction([
    prisma.gjenopprettingskode.deleteMany({ where: { userId } }),
    prisma.gjenopprettingskode.createMany({
      data: koder.map((k) => ({ userId, kodeHash: hash(k) })),
    }),
  ])
  return koder
}

/**
 * Bruker en kode. Atomisk: to samtidige innlogginger med samme kode kan ikke
 * begge lykkes, siden bare én oppdatering finner `bruktAt: null`.
 */
export async function brukKode(userId: string, kode: string): Promise<boolean> {
  if (!erGjenopprettingskode(kode)) return false
  const { count } = await prisma.gjenopprettingskode.updateMany({
    where: { userId, kodeHash: hash(kode), bruktAt: null },
    data: { bruktAt: new Date() },
  })
  return count === 1
}

export async function antallUbrukte(userId: string): Promise<number> {
  return prisma.gjenopprettingskode.count({ where: { userId, bruktAt: null } })
}

export async function slettKoder(userId: string): Promise<void> {
  await prisma.gjenopprettingskode.deleteMany({ where: { userId } })
}
