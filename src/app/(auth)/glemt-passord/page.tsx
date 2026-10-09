import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GlemtPassordSkjema } from "@/components/auth/glemt-passord-skjema"

export default function GlemtPassordPage() {
  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">LA</span>
          </div>
          <span className="font-semibold text-slate-800 text-lg">legeassist</span>
        </div>
        <CardTitle className="text-xl">Glemt passord</CardTitle>
        <CardDescription>
          Skriv inn e-postadressen din, så sender vi en lenke for å velge nytt passord.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GlemtPassordSkjema />
      </CardContent>
    </Card>
  )
}
