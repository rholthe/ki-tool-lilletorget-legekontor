import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { isAdmin } from "@/lib/admin"
import { BrukerAdministrasjon } from "@/components/admin/bruker-administrasjon"
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

      <BrukerAdministrasjon brukere={brukere} />
    </div>
  )
}
