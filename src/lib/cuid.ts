// Enkel klient-side ID-generator (crypto.randomUUID er tilgjengelig i moderne nettlesere)
export function cuid(): string {
  return crypto.randomUUID()
}
