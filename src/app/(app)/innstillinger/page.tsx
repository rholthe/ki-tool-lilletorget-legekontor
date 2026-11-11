import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { hentSystemSetting, standardModell, standardRegion, isAdmin } from "@/lib/admin"
import { InnstillingerKlient } from "@/components/settings/innstillinger-klient"
import { antallUbrukte } from "@/lib/gjenoppretting"
import { hentPasskeys } from "@/lib/passkey"
import { Suspense } from "react"

export default async function InnstillingerSide() {
  const session = await auth()
  const erAdmin = isAdmin(session?.user?.email)
  const [bruker, aktivModell, aktivRegion] = await Promise.all([
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: { name: true, email: true, hprNummer: true, twoFactorEnabled: true, dpaSignedAt: true, dpaVersion: true },
        })
      : null,
    hentSystemSetting("bedrock_model", standardModell()),
    hentSystemSetting("bedrock_region", standardRegion()),
  ])
  const ubrukteKoder = session?.user?.id && bruker?.twoFactorEnabled ? await antallUbrukte(session.user.id) : 0
  const passkeys = session?.user?.id ? await hentPasskeys(session.user.id) : []

  return (
    <Suspense>
      <InnstillingerKlient
        bruker={bruker}
        ubrukteKoder={ubrukteKoder}
        passkeys={passkeys}
        aktivModell={aktivModell}
        aktivRegion={aktivRegion}
        harBedrockNokler={Boolean(process.env.BEDROCK_API_KEY && process.env.BEDROCK_SECRET_KEY)}
        erAdmin={erAdmin}
      />
    </Suspense>
  )
}
