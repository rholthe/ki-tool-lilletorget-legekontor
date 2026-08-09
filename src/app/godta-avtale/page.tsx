import { redirect } from "next/navigation"
import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { harGyldigSignatur, hentGjeldendeDpa } from "@/lib/dpa"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GodtaAvtaleSkjema } from "@/components/dpa/godta-avtale-skjema"

export default async function GodtaAvtalePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const bruker = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dpaSignedAt: true, dpaVersion: true },
  })

  // Allerede gyldig signatur → ingen grunn til å være her
  if (await harGyldigSignatur(bruker)) redirect("/")

  const gjeldende = await hentGjeldendeDpa()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">LA</span>
            </div>
            <span className="font-semibold text-slate-800 text-lg">legeassist</span>
          </div>
          <CardTitle className="text-xl">Signer databehandleravtalen</CardTitle>
          <CardDescription>
            {bruker?.dpaSignedAt
              ? `Databehandleravtalen er oppdatert (versjon ${gjeldende.versjon}). Du må signere på nytt før du kan fortsette.`
              : `Du må signere databehandleravtalen (versjon ${gjeldende.versjon}) før du kan bruke legeassist.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <GodtaAvtaleSkjema />

          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <Button type="submit" variant="ghost" size="sm" className="w-full text-slate-500">
              Logg ut
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
