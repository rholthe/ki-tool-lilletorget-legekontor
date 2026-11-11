import { redirect } from "next/navigation"
import { FileText } from "lucide-react"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { hentSkjemaKategorier } from "@/lib/skjema/skjema-server"
import { SkjemaAdministrasjon } from "@/components/admin/skjema-administrasjon"

export default async function AdminSkjemaSide() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) redirect("/innstillinger")

  const kategorier = await hentSkjemaKategorier(true)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-rose-600" />
          <h1 className="text-xl font-semibold text-slate-800">Skjema</h1>
        </div>
        <p className="text-sm text-slate-500">
          Skjema legene kan få hjelp til å fylle ut. Hvert skjema har en feltliste og en instruks til AI.
          Felt med «Tekst i Pridok» kan sendes rett inn i skjemaet i Pridok. Her lagres bare
          definisjonen — utfylte skjema finnes kun i legens nettleser.
        </p>
      </div>
      <SkjemaAdministrasjon kategorier={kategorier} />
    </div>
  )
}
