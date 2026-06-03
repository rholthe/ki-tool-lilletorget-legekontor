"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { registrerBruker, type RegistrerState } from "@/actions/auth"

const initialState: RegistrerState = {}

export default function RegistrerPage() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    registrerBruker,
    initialState
  )

  useEffect(() => {
    if (state.success) {
      setTimeout(() => router.push("/login"), 1500)
    }
  }, [state.success, router])

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">LA</span>
          </div>
          <span className="font-semibold text-slate-800 text-lg">
            legeassist
          </span>
        </div>
        <CardTitle className="text-xl">Opprett konto</CardTitle>
        <CardDescription>Fyll inn informasjon for ny bruker</CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Navn</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Ola Nordmann"
              required
              autoFocus
            />
            {state.errors?.name && (
              <p className="text-xs text-red-600">{state.errors.name[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="lege@klinikk.no"
              required
            />
            {state.errors?.email && (
              <p className="text-xs text-red-600">{state.errors.email[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Passord</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Minst 8 tegn, en stor bokstav og ett tall"
              required
            />
            {state.errors?.password && (
              <p className="text-xs text-red-600">
                {state.errors.password[0]}
              </p>
            )}
          </div>

          {state.success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              {state.message} Sender deg til innlogging...
            </p>
          )}

          {state.message && !state.success && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.message}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || state.success}
          >
            {isPending ? "Oppretter konto..." : "Opprett konto"}
          </Button>
        </CardFooter>
      </form>

      <p className="text-center text-sm text-slate-500 pb-4">
        Har du allerede konto?{" "}
        <Link
          href="/login"
          className="text-blue-600 hover:underline font-medium"
        >
          Logg inn
        </Link>
      </p>
    </Card>
  )
}
