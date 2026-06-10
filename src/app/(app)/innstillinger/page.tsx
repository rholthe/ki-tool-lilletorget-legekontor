import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { hentSystemSetting, standardModell, standardRegion } from "@/lib/admin"
import { InnstillingerKlient } from "@/components/settings/innstillinger-klient"
import { Suspense } from "react"

export default async function InnstillingerSide() {
  const session = await auth()
  const [bruker, aktivModell, aktivRegion] = await Promise.all([
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: { name: true, email: true, twoFactorEnabled: true },
        })
      : null,
    hentSystemSetting("bedrock_model", standardModell()),
    hentSystemSetting("bedrock_region", standardRegion()),
  ])

  return (
    <Suspense>
      <InnstillingerKlient
        bruker={bruker}
        aktivModell={aktivModell}
        aktivRegion={aktivRegion}
        harBedrockNokler={Boolean(process.env.BEDROCK_API_KEY && process.env.BEDROCK_SECRET_KEY)}
      />
    </Suspense>
  )
}
