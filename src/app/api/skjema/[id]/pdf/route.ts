import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/** PDF-malen til et skjema (det tomme skjemaet). Fylles ut i nettleseren. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  const { id } = await params
  const pdf = await prisma.skjemaPdf.findUnique({ where: { skjemaId: id } })
  if (!pdf) return NextResponse.json({ feil: "Ikke funnet" }, { status: 404 })
  return new NextResponse(new Uint8Array(pdf.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "X-Pdf-Versjon": pdf.updatedAt.toISOString(),
    },
  })
}
