"use client"

import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { KonsultasjonView } from "./konsultasjon-view"
import { JournalgjennomgangView } from "./journalgjennomgang-view"
import { DiktatView } from "./diktat-view"
import { AiHjelpView } from "./ai-hjelp-view"

export function HovedInnhold() {
  const { aktiv } = useKonsultasjon()
  if (aktiv?.type === "JOURNALGJENNOMGANG") return <JournalgjennomgangView />
  if (aktiv?.type === "DIKTAT") return <DiktatView />
  if (aktiv?.type === "AIHJELP") return <AiHjelpView />
  return <KonsultasjonView />
}
