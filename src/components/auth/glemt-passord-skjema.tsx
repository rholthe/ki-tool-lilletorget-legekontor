"use client"

import { useActionState } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bePassordlenke, type GlemtPassordState } from "@/actions/tilgang"

const initialState: GlemtPassordState = {}

export function GlemtPassordSkjema() {
  const [state, formAction, isPending] = useActionState(bePassordlenke, initialState)

  if (state.sendt) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
          <MailCheck className="w-5 h-5 shrink-0 text-blue-600" />
          <p>
            Hvis adressen har en konto i legeassist, har vi sendt en lenke dit. Den gjelder i én time.
            Sjekk også søppelpost.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          To-faktor endres ikke: du logger inn med koden fra autentiseringsappen som før. Har du også
          mistet telefonen, bruk en gjenopprettingskode, eller kontakt administrator.
        </p>
        <div className="text-center">
          <Link href="/login" className="text-blue-600 hover:underline text-sm font-medium">
            ← Tilbake til innlogging
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="epost">E-post</Label>
        <Input
          id="epost"
          name="epost"
          type="email"
          autoComplete="email"
          placeholder="lege@klinikk.no"
          required
          autoFocus
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sender..." : "Send lenke"}
      </Button>
      <div className="text-center">
        <Link href="/login" className="text-slate-500 hover:underline text-sm">
          ← Tilbake til innlogging
        </Link>
      </div>
    </form>
  )
}
