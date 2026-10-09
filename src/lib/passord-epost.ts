import "server-only"
import { hentBasisUrl, sendEpost } from "@/lib/mail"
import { lagPassordOppsettToken } from "@/lib/passord-token"

/**
 * E-post for nytt passord. Lenken bytter bare passordet: to-faktor står urørt,
 * så den som overtar e-posten, kommer likevel ikke inn uten telefonen eller en
 * gjenopprettingskode.
 */

function hilsen(navn: string | null): string {
  return navn ? `Hei ${navn},` : "Hei,"
}

export async function sendPassordlenke(
  bruker: { id: string; email: string; name: string | null },
  opts: { gyldigMs: number; gyldigTekst: string; avAdministrator: boolean }
): Promise<void> {
  const token = await lagPassordOppsettToken(bruker.id, opts.gyldigMs)
  const lenke = `${await hentBasisUrl()}/sett-passord?token=${token}`
  await sendEpost({
    til: bruker.email,
    emne: "legeassist: lenke for nytt passord",
    tekst:
      `${hilsen(bruker.name)}\n\n` +
      (opts.avAdministrator
        ? `Administrator har sendt deg en lenke for å velge nytt passord i legeassist.\n\n`
        : `Noen ba om å tilbakestille passordet ditt i legeassist.\n\n`) +
      `Velg nytt passord her (lenken gjelder i ${opts.gyldigTekst} og virker én gang):\n${lenke}\n\n` +
      `To-faktor endres ikke — du logger inn med koden fra autentiseringsappen som før.\n\n` +
      (opts.avAdministrator
        ? `Har du ikke bedt om dette, kan du se bort fra e-posten; passordet ditt er uendret.\n\n`
        : `Var det ikke deg, kan du se bort fra e-posten; passordet ditt er uendret.\n\n`) +
      `Hilsen legeassist`,
  })
}

export async function sendPassordEndret(bruker: { email: string; name: string | null }): Promise<void> {
  try {
    await sendEpost({
      til: bruker.email,
      emne: "legeassist: passordet ditt er endret",
      tekst:
        `${hilsen(bruker.name)}\n\n` +
        `Passordet til kontoen din i legeassist ble nettopp endret.\n\n` +
        `Var det ikke deg, må du kontakte administrator straks.\n\n` +
        `Hilsen legeassist`,
    })
  } catch (e) {
    console.error(`[passord] varsel om endret passord feilet: ${e instanceof Error ? e.message : e}`)
  }
}
