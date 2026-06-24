"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { signerAvtale, type SignerState } from "@/actions/dpa"
import { DpaSammendrag } from "@/components/dpa/dpa-sammendrag"

const initialState: SignerState = {}

export function GodtaAvtaleSkjema() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(signerAvtale, initialState)

  useEffect(() => {
    if (state.success) {
      router.push("/")
      router.refresh()
    }
  }, [state.success, router])

  return (
    <form action={formAction} className="space-y-4">
      <DpaSammendrag />

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="godta"
          value="ja"
          required
          className="mt-0.5 accent-blue-600"
        />
        <span>
          Jeg har lest og signerer databehandleravtalen på vegne av meg selv som
          behandlingsansvarlig.
        </span>
      </label>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signerer..." : "Signer og fortsett"}
      </Button>
    </form>
  )
}
