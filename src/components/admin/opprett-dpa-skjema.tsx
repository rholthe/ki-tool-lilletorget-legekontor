"use client"

import { useActionState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { opprettDpaVersjon, type OpprettDpaState } from "@/actions/admin-dpa"

const initialState: OpprettDpaState = {}

export function OpprettDpaSkjema({ forrigeInnhold }: { forrigeInnhold: string }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(opprettDpaVersjon, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      router.refresh()
    }
  }, [state.success, router])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="versjon">Versjonsnummer</Label>
        <Input
          id="versjon"
          name="versjon"
          placeholder="f.eks. 2.0"
          className="max-w-[160px]"
          required
        />
        {state.errors?.versjon && (
          <p className="text-xs text-red-600">{state.errors.versjon[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="innhold">Avtaletekst (Markdown)</Label>
        <Textarea
          id="innhold"
          name="innhold"
          defaultValue={forrigeInnhold}
          rows={20}
          className="font-mono text-xs"
          required
        />
        {state.errors?.innhold && (
          <p className="text-xs text-red-600">{state.errors.innhold[0]}</p>
        )}
        <p className="text-xs text-slate-400">
          Støtter Markdown (overskrifter, lister, tabeller). Forhåndsutfylt med
          gjeldende tekst – rediger og publiser som ny versjon.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="krevNySignering" value="ja" defaultChecked className="mt-0.5 accent-blue-600" />
        <span>
          Betydelig endring – krev at alle brukere signerer på nytt ved neste
          innlogging.
        </span>
      </label>

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
        {isPending ? "Publiserer..." : "Publiser ny versjon"}
      </Button>
    </form>
  )
}
