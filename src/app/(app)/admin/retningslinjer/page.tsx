import { redirect } from "next/navigation"
import { BookOpen } from "lucide-react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { hentHapiStatus } from "@/lib/hapi/retningslinjer-server"
import { HapiStatus } from "@/components/admin/hapi-status"
import { Separator } from "@/components/ui/separator"

export default async function AdminRetningslinjerSide() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) redirect("/innstillinger")

  const status = await hentHapiStatus()

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-slate-800">Retningslinjer</h1>
        </div>
        <p className="text-sm text-slate-500">
          Innhold fra Helsedirektoratets API (NLOD), mellomlagret på serveren. Nøkkelen leses fra{" "}
          <code>.env</code> (HELSEDIR_API_KEY) og må være for produksjons-API-et, ikke QA.
        </p>
      </div>
      <Separator />
      <HapiStatus status={status} />
    </div>
  )
}
