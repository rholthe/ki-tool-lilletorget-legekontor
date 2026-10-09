import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { beregnKostnadUsd, hentPriser } from "@/lib/bruk-priser"

/**
 * Tar imot forbrukstall fra nettleseren etter hvert AI-kall og hver
 * opptaksøkt. Bare tall — skjemaet slipper ikke gjennom tekst utover
 * funksjons- og modellnavn. Øvre grenser stopper åpenbart feilaktige tall.
 */
const tall = (maks: number) => z.number().int().min(0).max(maks).default(0)

const skjema = z.object({
  tjeneste: z.enum(["BEDROCK", "SONIOX"]),
  funksjon: z.enum(["notat", "chat", "aihjelp", "promptbygger", "transkribering", "diktering"]),
  modell: z.string().max(120).regex(/^[\w.:\-/]+$/).optional(),
  inputTokens: tall(2_000_000),
  outputTokens: tall(200_000),
  cacheLesTokens: tall(2_000_000),
  cacheSkrivTokens: tall(2_000_000),
  lydMs: tall(8 * 60 * 60 * 1000),
  antallTegn: tall(2_000_000),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })

  const parsed = skjema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ feil: "Ugyldige forbrukstall" }, { status: 400 })
  const d = parsed.data

  const kostnadUsd = beregnKostnadUsd(d, await hentPriser())
  await prisma.bruk.create({
    data: { ...d, modell: d.modell ?? null, userId: session.user.id, kostnadUsd },
  })
  return new NextResponse(null, { status: 204 })
}
