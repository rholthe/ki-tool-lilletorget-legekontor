"use client"

import { useState } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Settings, ShieldCheck, LogOut, ChevronDown, User, Users, FileText, Megaphone, BarChart3, BookOpen } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { slettAlleKonsultasjoner } from "@/lib/idb"

interface Props {
  visNavn: string
  erAdmin: boolean
}

export function AppHeaderMeny({ visNavn, erAdmin }: Props) {
  const [bekreftUtlogging, setBekreftUtlogging] = useState(false)
  const [loggerUt, setLoggerUt] = useState(false)

  // Aktiv utlogging sletter brukerens konsultasjoner på maskinen. Automatisk
  // utlogging (inaktivitet, lukket nettleser) låser dem bare — se OktVakt.
  async function loggUtOgSlett() {
    setLoggerUt(true)
    try {
      await slettAlleKonsultasjoner()
    } finally {
      await signOut({ redirectTo: "/login?grunn=utlogget" })
    }
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors px-2 py-1.5 rounded-md hover:bg-slate-100">
        <User className="w-3.5 h-3.5" />
        <span>{visNavn}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Link href="/innstillinger" className="flex items-center gap-2 w-full">
              <Settings className="w-4 h-4" />
              Innstillinger
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link
              href="/databehandleravtale"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full"
            >
              <FileText className="w-4 h-4" />
              Databehandleravtale
            </Link>
          </DropdownMenuItem>
          {erAdmin && (
            <>
              <DropdownMenuItem>
                <Link href="/admin/innstillinger" className="flex items-center gap-2 w-full">
                  <ShieldCheck className="w-4 h-4" />
                  Admin
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/brukere" className="flex items-center gap-2 w-full">
                  <Users className="w-4 h-4" />
                  Brukere
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/bruk" className="flex items-center gap-2 w-full">
                  <BarChart3 className="w-4 h-4" />
                  Bruk og kostnader
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/retningslinjer" className="flex items-center gap-2 w-full">
                  <BookOpen className="w-4 h-4" />
                  Retningslinjer
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/skjema" className="flex items-center gap-2 w-full">
                  <FileText className="w-4 h-4" />
                  Skjema
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/meldinger" className="flex items-center gap-2 w-full">
                  <Megaphone className="w-4 h-4" />
                  Meldinger
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/admin/databehandleravtale" className="flex items-center gap-2 w-full">
                  <FileText className="w-4 h-4" />
                  DPA-versjoner
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => setBekreftUtlogging(true)}
          >
            <LogOut className="w-4 h-4" />
            Logg ut
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog open={bekreftUtlogging} onOpenChange={(o) => !loggerUt && setBekreftUtlogging(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Logge ut?</DialogTitle>
          <DialogDescription>
            Alle konsultasjonene dine på denne maskinen slettes når du logger ut.
            Dette kan ikke angres. Sørg for at notatene er overført til journalen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBekreftUtlogging(false)} disabled={loggerUt}>
            Avbryt
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={loggUtOgSlett}
            disabled={loggerUt}
          >
            {loggerUt ? "Logger ut…" : "Logg ut og slett"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
