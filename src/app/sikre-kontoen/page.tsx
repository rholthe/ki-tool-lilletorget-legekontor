import Link from "next/link"
import { redirect } from "next/navigation"
import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { erKrav2faAktivt } from "@/lib/to-faktor-krav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { ToFaktorSeksjon } from "@/components/settings/to-faktor-seksjon"

/**
 * Gate for obligatorisk to-faktor (egen rot-rute uten app-skall, som
 * /godta-avtale). (app)/layout.tsx sender hit brukere uten 2FA når kravet gjelder.
 */
export default async function SikreKontoenSide() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const bruker = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  })
  if (bruker?.twoFactorEnabled || !(await erKrav2faAktivt())) redirect("/")

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">LA</span>
            </div>
            <span className="font-semibold text-slate-800 text-lg">legeassist</span>
          </div>
          <CardTitle className="text-xl">Aktiver to-faktor for å fortsette</CardTitle>
          <CardDescription>
            Legeassist behandler pasientopplysninger, og alle brukere må nå logge inn med en
            engangskode fra mobilen i tillegg til passordet. Installer en autentiseringsapp
            (f.eks. Microsoft Authenticator eller Google Authenticator),
            trykk «Aktiver 2FA» og skann QR-koden.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <ToFaktorSeksjon er2FAaktivert={false} />

          <Link href="/" className={buttonVariants({ variant: "outline", className: "w-full" })}>
            Jeg har aktivert to-faktor – fortsett
          </Link>

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
