/**
 * Kontroll av fødselsnummer og D-nummer (11 siffer, to kontrollsifre, modulus 11).
 * Brukes både på det utvidelsen leser fra Pridok og på det legen skriver selv —
 * en tastefeil skal ikke følge med inn i et skjema.
 */

const K1 = [3, 7, 6, 1, 8, 9, 4, 5, 2]
const K2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

function kontroll(siffer: number[], vekter: number[]): number | null {
  const rest = vekter.reduce((sum, v, i) => sum + v * siffer[i], 0) % 11
  const k = rest === 0 ? 0 : 11 - rest
  return k === 10 ? null : k
}

/** Fjerner mellomrom og bindestrek («141075-12345» → «14107512345»). */
export function rensFnr(tekst: string): string {
  return tekst.replace(/[\s-]/g, "")
}

export function erGyldigFnr(tekst: string): boolean {
  const f = rensFnr(tekst)
  if (!/^\d{11}$/.test(f)) return false
  const s = [...f].map(Number)
  const k1 = kontroll(s, K1)
  if (k1 === null || k1 !== s[9]) return false
  const k2 = kontroll(s, K2)
  return k2 !== null && k2 === s[10]
}

/** «ddmmåå xxxxx» for visning. */
export function formaterFnr(tekst: string): string {
  const f = rensFnr(tekst)
  return f.length === 11 ? `${f.slice(0, 6)} ${f.slice(6)}` : tekst
}
