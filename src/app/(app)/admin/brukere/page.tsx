import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { isAdmin } from "@/lib/admin"
import { BrukerAdministrasjon } from "@/components/admin/bruker-administrasjon"
import { Krav2faSkjema } from "@/components/admin/krav-2fa-skjema"
import { hentKrav2faFra, dagensDatoNorge, datoTekst } from "@/lib/to-faktor-krav"
import { Users } from "lucide-react"

export default async function AdminBrukereSide() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect("/innstillinger")
  }

  const rader = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      twoFactorEnabled: true,
      passwordHash: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const krav2faFra = await hentKrav2faFra()
  const med2fa = rader.filter((r) => r.twoFactorEnabled).length

  const brukere = rader.map(({ passwordHash, ...rest }) => ({
    ...rest,
    harSattPassord: passwordHash !== null,
    erAdmin: isAdmin(rest.email),
  }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-slate-800">Brukere</h1>
        </div>
        <p className="text-sm text-slate-500">
          Opprett nye brukerkontoer og se hvem som har aktivert to-faktor. Kun
          administratorer kan opprette brukere – selvregistrering er deaktivert.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Obligatorisk to-faktor</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {med2fa} av {rader.length} brukere har aktivert to-faktor.{" "}
            {krav2faFra
              ? dagensDatoNorge() >= krav2faFra
                ? "Kravet gjelder nå: brukere uten to-faktor må aktivere det før de kommer inn."
                : `Fra ${datoTekst(krav2faFra)} må brukere uten to-faktor aktivere det før de kommer inn. Frem til da får de en daglig påminnelse.`
              : "Ikke obligatorisk ennå."}
          </p>
        </div>
        <Krav2faSkjema dato={krav2faFra} />
      </section>

      <BrukerAdministrasjon brukere={brukere} />
    </div>
  )
}
