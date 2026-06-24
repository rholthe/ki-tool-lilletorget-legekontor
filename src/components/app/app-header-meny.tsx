"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { Settings, ShieldCheck, LogOut, ChevronDown, User, Users } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"

interface Props {
  visNavn: string
  erAdmin: boolean
}

export function AppHeaderMeny({ visNavn, erAdmin }: Props) {
  return (
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
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="w-4 h-4" />
            Logg ut
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
