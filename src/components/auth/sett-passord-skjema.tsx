"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2 } from "lucide-react"
import { settPassordMedToken, type SettPassordState } from "@/actions/tilgang"

const initialState: SettPassordState = {}

export function SettPassordSkjema({ token }: { token: string }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    settPassordMedToken,
    initialState
  )

  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => router.push("/login"), 2000)
      return () => clearTimeout(t)
    }
  }, [state.success, router])

  if (state.success) {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <p className="font-semibold text-slate-800">Passord satt!</p>
        <p className="text-sm text-slate-500">Sender deg til innlogging...</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <Label htmlFor="passord">Nytt passord</Label>
        <Input
          id="passord"
          name="passord"
          type="password"
          autoComplete="new-password"
          placeholder="Minst 8 tegn, en stor bokstav og ett tall"
          required
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gjenta">Gjenta passord</Label>
        <Input
          id="gjenta"
          name="gjenta"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Lagrer..." : "Sett passord og fullfør"}
      </Button>
    </form>
  )
}
