"use client"

import { useEffect } from "react"
import { signOut } from "next-auth/react"
import type { UtloggingGrunn } from "@/lib/okt"

export function Utlogging({ grunn }: { grunn: UtloggingGrunn }) {
  useEffect(() => {
    signOut({ redirectTo: `/login?grunn=${grunn}` })
  }, [grunn])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
      Logger ut…
    </div>
  )
}
