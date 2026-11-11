import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { MAKS_PDF_BYTE } from "@/lib/skjema/skjema-server"

async function erAdmin(): Promise<boolean> {
  const session = await auth()
  const epost = session?.user?.email
  return Boolean(epost && isAdmin(epost))
}

/** Laster opp (eller bytter) PDF-malen til et skjema. Kroppen er selve filen. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await erAdmin())) return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  const { id } = await params

  const lengde = Number(req.headers.get("content-length") ?? 0)
  if (lengde > MAKS_PDF_BYTE) return NextResponse.json({ feil: "Filen er for stor (maks 10 MB)." }, { status: 413 })
  const data = new Uint8Array(await req.arrayBuffer())
  if (data.length === 0 || data.length > MAKS_PDF_BYTE) {
    return NextResponse.json({ feil: "Filen er tom eller for stor (maks 10 MB)." }, { status: 413 })
  }
  // «%PDF-» skal stå helt i starten (noen filer har litt søppel foran)
  const start = new TextDecoder("latin1").decode(data.subarray(0, 1024))
  if (!start.includes("%PDF-")) return NextResponse.json({ feil: "Filen er ikke en PDF." }, { status: 400 })

  if (!(await prisma.skjema.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ feil: "Skjemaet finnes ikke." }, { status: 404 })
  }

  let filnavn = "skjema.pdf"
  try {
    filnavn = decodeURIComponent(req.headers.get("x-filnavn") ?? "").slice(0, 200) || filnavn
  } catch {
    // ugyldig koding — behold standardnavnet
  }

  const felt = { filnavn, storrelse: data.length, data }
  const pdf = await prisma.skjemaPdf.upsert({
    where: { skjemaId: id },
    create: { skjemaId: id, ...felt },
    update: felt,
    select: { filnavn: true, updatedAt: true },
  })
  return NextResponse.json({ filnavn: pdf.filnavn, versjon: pdf.updatedAt.toISOString() })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await erAdmin())) return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  const { id } = await params
  await prisma.skjemaPdf.deleteMany({ where: { skjemaId: id } })
  return NextResponse.json({ ok: true })
}
