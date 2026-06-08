"use client"

import { KonsultasjonView } from "@/components/app/konsultasjon-view"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"

export default function HovedSide() {
  const { aktiv } = useKonsultasjon()
  // key={aktiv?.id} tvinger remount når aktiv konsultasjon bytter,
  // slik at useTranskribering-hooken alltid starter frisk og aldri
  // arver opptakstilstand fra en annen konsultasjon.
  return <KonsultasjonView key={aktiv?.id ?? "ingen"} />
}
