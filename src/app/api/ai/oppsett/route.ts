import { NextResponse } from "next/server"
import { STSClient, GetFederationTokenCommand } from "@aws-sdk/client-sts"
import { auth } from "@/lib/auth"
import { hentSystemSetting, standardModell, standardRegion } from "@/lib/admin"
import { hentStagingOverrides } from "@/lib/staging-server"
import { maaAktivere2fa } from "@/lib/to-faktor-krav"

/**
 * Alt nettleseren trenger for å kalle Claude på Bedrock selv, uten at
 * pasientinnhold går via serveren:
 *
 * - kortlivede AWS-nøkler (STS GetFederationToken, 1 t) per bruker. Nøklene kan
 *   bare kalle Anthropic-modeller i EU-regioner (sesjonspolicyen under, snitt
 *   med IAM-brukerens egne rettigheter). Navnet `la-<userId>` gjør at CloudTrail
 *   viser hvem som har kalt Bedrock.
 * - modell og region fra admin-innstillingene
 * - admin-overrides for systemprompter (staging), som bygges i nettleseren
 *
 * IAM-brukeren i BEDROCK_API_KEY må ha `sts:GetFederationToken` på
 * `arn:aws:sts::<konto>:federated-user/la-*`.
 */

const VARIGHET_S = 60 * 60

const SESJONSPOLICY = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Action: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      Resource: [
        "arn:aws:bedrock:eu-*:*:inference-profile/eu.anthropic.*",
        "arn:aws:bedrock:eu-*::foundation-model/anthropic.*",
      ],
    },
  ],
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }
  if (await maaAktivere2fa(session.user.id)) {
    return NextResponse.json(
      { feil: "To-faktor er obligatorisk. Aktiver det under Innstillinger → Konto." },
      { status: 403 }
    )
  }
  if (!process.env.BEDROCK_API_KEY || !process.env.BEDROCK_SECRET_KEY) {
    return NextResponse.json({ feil: "Bedrock-nøkler mangler på serveren" }, { status: 500 })
  }

  const [modell, region, overrides] = await Promise.all([
    hentSystemSetting("bedrock_model", standardModell()),
    hentSystemSetting("bedrock_region", standardRegion()),
    hentStagingOverrides(),
  ])

  try {
    const sts = new STSClient({
      region,
      credentials: {
        accessKeyId: process.env.BEDROCK_API_KEY,
        secretAccessKey: process.env.BEDROCK_SECRET_KEY,
      },
    })
    const svar = await sts.send(
      new GetFederationTokenCommand({
        Name: `la-${session.user.id}`.slice(0, 32),
        DurationSeconds: VARIGHET_S,
        Policy: SESJONSPOLICY,
      })
    )
    const c = svar.Credentials
    if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken || !c.Expiration) {
      throw new Error("Tomt svar fra STS")
    }
    return NextResponse.json(
      {
        modell,
        region,
        overrides: Object.fromEntries(overrides),
        legitimasjon: {
          accessKeyId: c.AccessKeyId,
          secretAccessKey: c.SecretAccessKey,
          sessionToken: c.SessionToken,
          utloper: c.Expiration.getTime(),
        },
      },
      { headers: { "Cache-Control": "no-store, private" } }
    )
  } catch (e) {
    console.error("GetFederationToken feilet:", e instanceof Error ? e.name : "ukjent")
    return NextResponse.json({ feil: "Kunne ikke hente AI-tilgang fra AWS" }, { status: 502 })
  }
}
