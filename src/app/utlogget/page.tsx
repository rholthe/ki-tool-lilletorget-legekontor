import { Utlogging } from "./utlogging"

/**
 * Offentlig mellomstasjon: proxyen sender hit når nettleseren har vært lukket.
 * Klienten logger ut via Auth.js (sletter innloggingscookien) og går til /login.
 */
export default async function UtloggetSide({
  searchParams,
}: {
  searchParams: Promise<{ grunn?: string }>
}) {
  const { grunn } = await searchParams
  return <Utlogging grunn={grunn === "lukket" ? "lukket" : "utlopt"} />
}
