"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { settMeldingAktiv } from "@/actions/meldinger"

/** Trekk tilbake / publiser på nytt. Lesestatus beholdes uansett. */
export function MeldingAktivKnapp({ id, aktiv }: { id: string; aktiv: boolean }) {
  const router = useRouter()
  const [venter, start] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={venter}
      onClick={() =>
        start(async () => {
          await settMeldingAktiv(id, !aktiv)
          router.refresh()
        })
      }
    >
      {aktiv ? "Trekk tilbake" : "Publiser på nytt"}
    </Button>
  )
}
