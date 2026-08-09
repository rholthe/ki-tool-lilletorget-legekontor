import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import {
  isAdmin,
  hentSystemSetting,
  settSystemSetting,
  tilgjengeligeModeller,
  tilgjengeligeRegioner,
  standardModell,
  standardRegion,
} from "@/lib/admin"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 403 })
  }

  const availableModels = tilgjengeligeModeller()
  const availableRegions = tilgjengeligeRegioner()
  const model = await hentSystemSetting("bedrock_model", standardModell())
  const region = await hentSystemSetting("bedrock_region", standardRegion())

  return NextResponse.json({ model, region, availableModels, availableRegions })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 403 })
  }

  const { model, region } = await req.json()

  const availableModels = tilgjengeligeModeller()
  const availableRegions = tilgjengeligeRegioner()

  if (model && availableModels.includes(model)) {
    await settSystemSetting("bedrock_model", model)
  }
  if (region && availableRegions.includes(region)) {
    await settSystemSetting("bedrock_region", region)
  }

  return NextResponse.json({ ok: true })
}
