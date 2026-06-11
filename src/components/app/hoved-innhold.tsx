"use client"

import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { KonsultasjonView } from "./konsultasjon-view"
import { JournalgjennomgangView } from "./journalgjennomgang-view"

export function HovedInnhold() {
  const { aktiv } = useKonsultasjon()
  if (aktiv?.type === "JOURNALGJENNOMGANG") return <JournalgjennomgangView />
  return <KonsultasjonView />
}
