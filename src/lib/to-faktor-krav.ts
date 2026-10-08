import "server-only"
import { prisma } from "@/lib/db"
import { hentSystemSetting } from "@/lib/admin"

/**
 * Obligatorisk to-faktor fra en dato satt av admin (SystemSetting
 * `krev_2fa_fra`, YYYY-MM-DD, norsk tid). Tom = ikke obligatorisk.
 * Fra datoen må brukere uten 2FA aktivere det (/sikre-kontoen) før de får
 * bruke appen, og AI- og transkripsjonsendepunktene avviser dem.
 */
export const KREV_2FA_NOKKEL = "krev_2fa_fra"

/** Dagens dato i Norge som YYYY-MM-DD. */
export function dagensDatoNorge(naa = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(naa)
}

/** Datoen kravet gjelder fra, eller null. */
export async function hentKrav2faFra(): Promise<string | null> {
  const v = (await hentSystemSetting(KREV_2FA_NOKKEL, "")).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export async function erKrav2faAktivt(): Promise<boolean> {
  const fra = await hentKrav2faFra()
  return fra !== null && dagensDatoNorge() >= fra
}

/** Sant når brukeren må aktivere 2FA før hen kan bruke appen. */
export async function maaAktivere2fa(userId: string): Promise<boolean> {
  if (!(await erKrav2faAktivt())) return false
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } })
  return !bruker?.twoFactorEnabled
}

/** Norsk visning av en YYYY-MM-DD-dato, f.eks. «fredag 16. oktober». */
export function datoTekst(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Oslo",
  })
}
