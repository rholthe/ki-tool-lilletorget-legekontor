"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { sendTilgangsforesporsel, type TilgangState } from "@/actions/tilgang"

const initialState: TilgangState = {}

export default function TilgangPage() {
  const [state, formAction, isPending] = useActionState(
    sendTilgangsforesporsel,
    initialState
  )

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">LA</span>
          </div>
          <span className="font-semibold text-slate-800 text-lg">legeassist</span>
        </div>
        <CardTitle className="text-xl">Be om tilgang</CardTitle>
        <CardDescription>
          Send en forespørsel til administrator, så blir du kontaktet når kontoen
          er klar.
        </CardDescription>
      </CardHeader>

      {state.success ? (
        <CardContent>
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-3">
            {state.message}
          </p>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-blue-600 hover:underline text-sm font-medium">
              ← Tilbake til innlogging
            </Link>
          </div>
        </CardContent>
      ) : (
        <form action={formAction}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="navn">Navn</Label>
              <Input id="navn" name="navn" type="text" placeholder="Ola Nordmann" required autoFocus />
              {state.errors?.navn && (
                <p className="text-xs text-red-600">{state.errors.navn[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="epost">E-post</Label>
              <Input id="epost" name="epost" type="email" placeholder="lege@klinikk.no" required />
              {state.errors?.epost && (
                <p className="text-xs text-red-600">{state.errors.epost[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="arbeidssted">Arbeidssted / klinikk</Label>
              <Input
                id="arbeidssted"
                name="arbeidssted"
                type="text"
                placeholder="Lilletorget legesenter"
                required
              />
              {state.errors?.arbeidssted && (
                <p className="text-xs text-red-600">{state.errors.arbeidssted[0]}</p>
              )}
            </div>

            {state.message && !state.success && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {state.message}
              </p>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Sender..." : "Send forespørsel"}
            </Button>
            <Link href="/login" className="text-sm text-slate-500 hover:underline">
              ← Tilbake til innlogging
            </Link>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}
