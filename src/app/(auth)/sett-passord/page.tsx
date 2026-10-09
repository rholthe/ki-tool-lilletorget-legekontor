import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { finnBrukerForToken } from "@/lib/passord-token"
import { SettPassordSkjema } from "@/components/auth/sett-passord-skjema"

export default async function SettPassordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const bruker = token ? await finnBrukerForToken(token) : null

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">LA</span>
          </div>
          <span className="font-semibold text-slate-800 text-lg">legeassist</span>
        </div>
        <CardTitle className="text-xl">{bruker?.harPassord ? "Nytt passord" : "Sett passord"}</CardTitle>
        <CardDescription>
          {bruker
            ? bruker.harPassord
              ? `Velg et nytt passord for ${bruker.email}. To-faktor endres ikke.`
              : `Velg et passord for ${bruker.email}.`
            : "Lenken er ugyldig eller utløpt."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {bruker ? (
          <SettPassordSkjema token={token!} tilbakestilling={bruker.harPassord} />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-3">
              Lenken er ikke lenger gyldig. Lenker for nytt passord gjelder i én time og
              virker én gang. Be om en ny under «Glemt passord?» på innloggingssiden, eller
              kontakt administrator.
            </p>
            <div className="text-center">
              <Link href="/login" className="text-blue-600 hover:underline text-sm font-medium">
                ← Tilbake til innlogging
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
