"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { ShieldCheck, ShieldOff, UserPlus, Mail, Clock, CheckCircle2, Trash2, ShieldAlert, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  nullstill2fa,
  opprettBruker,
  sendInvitasjonPaaNytt,
  slettBruker,
  type OpprettBrukerState,
} from "@/actions/admin-brukere"

interface BrukerRad {
  id: string
  name: string | null
  email: string
  twoFactorEnabled: boolean
  harSattPassord: boolean
  erAdmin: boolean
}

interface Props {
  brukere: BrukerRad[]
}

const initialState: OpprettBrukerState = {}

export function BrukerAdministrasjon({ brukere }: Props) {
  const [state, formAction, isPending] = useActionState(opprettBruker, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <div className="space-y-6">
      {/* Opprett bruker */}
      <form ref={formRef} action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Navn</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="off"
              placeholder="Ola Nordmann"
              required
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
              autoComplete="off"
              placeholder="lege@klinikk.no"
              required
            />
            {state.errors?.email && (
              <p className="text-xs text-red-600">{state.errors.email[0]}</p>
            )}
          </div>
        </div>

        {state.success && state.message && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 space-y-1">
            <p>{state.message}</p>
            {state.advarsel && <p className="text-amber-700">{state.advarsel}</p>}
          </div>
        )}
        {!state.success && state.message && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {state.message}
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            Brukeren får en e-post med lenke for å velge eget passord. Admin setter
            ikke passord – kontoen er låst til brukeren har gjort dette.
          </p>
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            {isPending ? "Oppretter..." : "Opprett og inviter"}
          </Button>
        </div>
      </form>

      {/* Brukerliste */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-medium">Navn</th>
              <th className="px-4 py-2.5 font-medium">E-post</th>
              <th className="px-4 py-2.5 font-medium">Rolle</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">2FA</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {brukere.map((b) => (
              <BrukerRadVisning key={b.id} bruker={b} />
            ))}
            {brukere.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Ingen brukere ennå.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BrukerRadVisning({ bruker }: { bruker: BrukerRad }) {
  const [pending, startTransition] = useTransition()
  const [tilbakemelding, setTilbakemelding] = useState<{ ok: boolean; tekst: string } | null>(null)
  const [slettAapen, setSlettAapen] = useState(false)
  const [sletter, startSletting] = useTransition()
  const [slettFeil, setSlettFeil] = useState("")
  const [nullstillAapen, setNullstillAapen] = useState(false)
  const [nullstiller, startNullstilling] = useTransition()
  const [nullstillFeil, setNullstillFeil] = useState("")

  function bekreftNullstilling() {
    setNullstillFeil("")
    startNullstilling(async () => {
      const res = await nullstill2fa(bruker.id)
      if (res.ok) {
        setNullstillAapen(false)
        setTilbakemelding({ ok: true, tekst: "To-faktor nullstilt" })
      } else {
        setNullstillFeil(res.melding ?? "Nullstilling feilet")
      }
    })
  }

  function resend() {
    setTilbakemelding(null)
    startTransition(async () => {
      const res = await sendInvitasjonPaaNytt(bruker.id)
      setTilbakemelding({ ok: !!res.ok, tekst: res.melding ?? "" })
    })
  }

  function bekreftSletting() {
    setSlettFeil("")
    startSletting(async () => {
      const res = await slettBruker(bruker.id)
      if (res.ok) {
        setSlettAapen(false)
      } else {
        setSlettFeil(res.melding ?? "Sletting feilet")
      }
    })
  }

  return (
    <tr className="border-b border-slate-100 last:border-0 align-middle">
      <td className="px-4 py-2.5 text-slate-700">{bruker.name ?? "–"}</td>
      <td className="px-4 py-2.5 text-slate-600">{bruker.email}</td>
      <td className="px-4 py-2.5">
        {bruker.erAdmin ? (
          <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
            <ShieldAlert className="w-3 h-3 mr-1" /> Admin
          </Badge>
        ) : (
          <span className="text-xs text-slate-500">Bruker</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {bruker.harSattPassord ? (
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Aktiv
          </Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
            <Clock className="w-3 h-3 mr-1" /> Venter på passord
          </Badge>
        )}
      </td>
      <td className="px-4 py-2.5">
        {bruker.twoFactorEnabled ? (
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
            <ShieldCheck className="w-3 h-3 mr-1" /> Aktiv
          </Badge>
        ) : (
          <Badge variant="outline" className="text-slate-500 text-xs border-slate-300">
            <ShieldOff className="w-3 h-3 mr-1" /> Inaktiv
          </Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          {tilbakemelding && (
            <span className={`text-xs ${tilbakemelding.ok ? "text-green-600" : "text-red-600"}`}>
              {tilbakemelding.tekst}
            </span>
          )}
          {!bruker.harSattPassord && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={resend} disabled={pending}>
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              {pending ? "Sender..." : "Send på nytt"}
            </Button>
          )}
          {bruker.twoFactorEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              title="Når brukeren har mistet telefonen og gjenopprettingskodene"
              onClick={() => {
                setNullstillFeil("")
                setNullstillAapen(true)
              }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Nullstill 2FA
            </Button>
          )}
          {!bruker.erAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
              onClick={() => {
                setSlettFeil("")
                setSlettAapen(true)
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Slett
            </Button>
          )}
        </div>

        <Dialog open={nullstillAapen} onOpenChange={setNullstillAapen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nullstille to-faktor?</DialogTitle>
              <DialogDescription>
                To-faktor og gjenopprettingskodene til <strong>{bruker.email}</strong> slettes.
                Brukeren logger da inn med bare passord, og må sette opp to-faktor på nytt —
                når det er obligatorisk, før appen kan brukes. Brukeren får e-post om
                nullstillingen. Gjør dette bare når du vet at det er brukeren selv som har
                mistet tilgangen.
              </DialogDescription>
            </DialogHeader>
            {nullstillFeil && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {nullstillFeil}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setNullstillAapen(false)}>
                Avbryt
              </Button>
              <Button size="sm" onClick={bekreftNullstilling} disabled={nullstiller}>
                {nullstiller ? "Nullstiller..." : "Nullstill to-faktor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={slettAapen} onOpenChange={setSlettAapen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Slette bruker?</DialogTitle>
              <DialogDescription>
                Dette sletter <strong>{bruker.email}</strong> permanent, inkludert
                brukerens maler. Handlingen kan ikke angres.
              </DialogDescription>
            </DialogHeader>
            {slettFeil && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {slettFeil}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setSlettAapen(false)}>
                Avbryt
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={bekreftSletting}
                disabled={sletter}
              >
                {sletter ? "Sletter..." : "Slett bruker"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  )
}
