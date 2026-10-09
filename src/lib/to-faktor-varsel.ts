import "server-only"
import { sendEpost } from "@/lib/mail"

/**
 * E-post når noe skjer med en brukers to-faktor som brukeren selv ikke
 * nødvendigvis står bak. Feiler sendingen, logges det (uten innhold) — innloggingen
 * eller nullstillingen skal ikke stoppe av den grunn.
 */

function hilsen(navn: string | null): string {
  return navn ? `Hei ${navn},` : "Hei,"
}

export async function varsleBruktGjenopprettingskode(
  bruker: { email: string; name: string | null },
  igjen: number
): Promise<void> {
  try {
    await sendEpost({
      til: bruker.email,
      emne: "legeassist: en gjenopprettingskode ble brukt",
      tekst:
        `${hilsen(bruker.name)}\n\n` +
        `Det ble nettopp logget inn på kontoen din i legeassist med en gjenopprettingskode ` +
        `i stedet for koden fra autentiseringsappen. Du har ${igjen} ubrukte koder igjen.\n\n` +
        `Har du mistet telefonen, bør du sette opp to-faktor på nytt under Innstillinger, ` +
        `eller be administrator nullstille den.\n\n` +
        `Var det ikke deg, må du kontakte administrator straks og bytte passord.\n\n` +
        `Hilsen legeassist`,
    })
  } catch (e) {
    console.error(`[2fa] varsel om brukt gjenopprettingskode feilet: ${e instanceof Error ? e.message : e}`)
  }
}

export async function varsleNullstilt2fa(bruker: { email: string; name: string | null }): Promise<void> {
  try {
    await sendEpost({
      til: bruker.email,
      emne: "legeassist: to-faktor er nullstilt for kontoen din",
      tekst:
        `${hilsen(bruker.name)}\n\n` +
        `Administrator har nullstilt to-faktor-autentiseringen for kontoen din i legeassist. ` +
        `Sett opp autentiseringsappen på nytt under Innstillinger, og lagre de nye ` +
        `gjenopprettingskodene. Når to-faktor er obligatorisk, må dette gjøres ved neste ` +
        `innlogging før appen kan brukes.\n\n` +
        `Har du ikke bedt om dette, kontakt administrator.\n\n` +
        `Hilsen legeassist`,
    })
  } catch (e) {
    console.error(`[2fa] varsel om nullstilling feilet: ${e instanceof Error ? e.message : e}`)
  }
}
