"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Markdown } from "@/components/dpa/markdown"
import { opprettMelding, type OpprettMeldingState } from "@/actions/meldinger"

const initialState: OpprettMeldingState = {}

export function OpprettMeldingSkjema({ forslag }: { forslag?: { tittel: string; innhold: string } }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [innhold, setInnhold] = useState(forslag?.innhold ?? "")
  const [visForhand, setVisForhand] = useState(false)
  const [state, formAction, isPending] = useActionState(
    async (prev: OpprettMeldingState, formData: FormData) => {
      const resultat = await opprettMelding(prev, formData)
      if (resultat.success) {
        formRef.current?.reset()
        setInnhold("")
        setVisForhand(false)
      }
      return resultat
    },
    initialState
  )

  useEffect(() => {
    if (state.success) router.refresh()
  }, [state.success, router])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="tittel">Tittel</Label>
        <Input id="tittel" name="tittel" defaultValue={forslag?.tittel} required maxLength={200} />
        {state.errors?.tittel && <p className="text-xs text-red-600">{state.errors.tittel[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="innhold">Melding (Markdown)</Label>
          <button
            type="button"
            onClick={() => setVisForhand((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
          >
            {visForhand ? "Rediger" : "Forhåndsvis"}
          </button>
        </div>
        {/* Tekstfeltet blir stående i skjemaet (skjult) så verdien sendes også fra forhåndsvisning */}
        <Textarea
          id="innhold"
          name="innhold"
          value={innhold}
          onChange={(e) => setInnhold(e.target.value)}
          rows={16}
          className={visForhand ? "hidden" : "font-mono text-xs"}
          required
        />
        {visForhand && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-1 max-h-[480px] overflow-y-auto">
            <Markdown>{innhold || "_(tom)_"}</Markdown>
          </div>
        )}
        {state.errors?.innhold && <p className="text-xs text-red-600">{state.errors.innhold[0]}</p>}
        <p className="text-xs text-slate-400">
          Vises som en stor melding øverst i appen for alle brukere til de trykker «Jeg har lest».
        </p>
      </div>

      {state.success && state.message && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {state.message}
        </p>
      )}
      {!state.success && state.message && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
        {isPending ? "Publiserer..." : "Publiser melding"}
      </Button>
    </form>
  )
}
