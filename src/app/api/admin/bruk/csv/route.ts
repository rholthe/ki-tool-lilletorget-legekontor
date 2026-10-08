import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { hentPriser } from "@/lib/bruk-priser"
import { hentMaanedsstatistikk, tolkMaaned } from "@/lib/bruk-statistikk"

/** Månedsstatistikk per bruker som CSV (semikolon og komma som desimaltegn, for norsk Excel). */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 403 })
  }
  const mnd = tolkMaaned(new URL(req.url).searchParams.get("mnd"))
  const [{ brukere }, priser] = await Promise.all([hentMaanedsstatistikk(mnd), hentPriser()])

  const des = (n: number, d = 2) => n.toFixed(d).replace(".", ",")
  const felt = (v: string) => `"${v.replace(/"/g, '""')}"`
  const linjer = [
    ["Måned", "Navn", "E-post", "AI-kall", "Tokens inn", "Tokens ut", "Claude USD", "Opptak", "Lydtimer", "Tegn", "Soniox USD", "Sum USD", "Sum NOK"].join(";"),
    ...brukere.map((b) =>
      [
        mnd, felt(b.navn), felt(b.epost), b.aiKall, b.inputTokens, b.outputTokens, des(b.aiKostnadUsd, 4),
        b.opptak, des(b.lydTimer, 3), b.antallTegn, des(b.sonioxKostnadUsd, 4), des(b.sumUsd, 4), des(b.sumUsd * priser.usdNok),
      ].join(";")
    ),
  ]
  return new NextResponse("﻿" + linjer.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="legeassist-bruk-${mnd}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
