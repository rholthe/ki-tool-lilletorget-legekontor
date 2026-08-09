import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { isAdmin, hentSystemSetting, settSystemSetting, slettSystemSetting } from "@/lib/admin"
import { STAGING_REGISTRY, STAGING_KEYS } from "@/lib/staging-registry"

const PREFIKS = "staging:"

async function krevAdmin() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) return null
  return session
}

export async function GET() {
  if (!(await krevAdmin())) {
    return NextResponse.json({ feil: "Ingen tilgang" }, { status: 403 })
  }

  const oppføringer = await Promise.all(
    STAGING_REGISTRY.map(async (e) => {
      const override = await hentSystemSetting(PREFIKS + e.key, "")
      const erOverstyrt = override !== ""
      return {
        key: e.key,
        gruppe: e.gruppe,
        label: e.label,
        beskrivelse: e.beskrivelse,
        standard: e.standard,
        verdi: erOverstyrt ? override : e.standard,
        erOverstyrt,
      }
    })
  )

  return NextResponse.json(oppføringer)
}

export async function PUT(req: Request) {
  if (!(await krevAdmin())) {
    return NextResponse.json({ feil: "Ingen tilgang" }, { status: 403 })
  }

  const { key, verdi } = await req.json()
  if (typeof key !== "string" || !STAGING_KEYS.has(key)) {
    return NextResponse.json({ feil: "Ukjent staging-nøkkel" }, { status: 400 })
  }
  if (typeof verdi !== "string" || !verdi.trim()) {
    return NextResponse.json({ feil: "Tom verdi" }, { status: 400 })
  }

  await settSystemSetting(PREFIKS + key, verdi)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  if (!(await krevAdmin())) {
    return NextResponse.json({ feil: "Ingen tilgang" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const key = searchParams.get("key")
  if (!key || !STAGING_KEYS.has(key)) {
    return NextResponse.json({ feil: "Ukjent staging-nøkkel" }, { status: 400 })
  }

  await slettSystemSetting(PREFIKS + key)
  return NextResponse.json({ ok: true })
}
