import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { hentPriser } from "@/lib/bruk-priser"
import { hentDagsstatistikk, tolkMaaned } from "@/lib/bruk-statistikk"

/**
 * Forbruk per bruker per dag for en måned, som CSV (semikolon og komma som
 * desimaltegn, for norsk Excel). Bare dager med aktivitet. Summen av linjene er
 * månedstallene på /admin/bruk.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 403 })
  }
  const mnd = tolkMaaned(new URL(req.url).searchParams.get("mnd"))
  const [dager, priser] = await Promise.all([hentDagsstatistikk(mnd), hentPriser()])

  const des = (n: number, d = 2) => n.toFixed(d).replace(".", ",")
  const felt = (v: string) => `"${v.replace(/"/g, '""')}"`
  const linjer = [
    ["Dato", "Navn", "E-post", "AI-kall", "Tokens inn", "Tokens ut", "Claude USD", "Opptak", "Lydtimer", "Tegn", "Soniox USD", "Sum USD", "Sum NOK"].join(";"),
    ...dager.map((b) =>
      [
        b.dato, felt(b.navn), felt(b.epost), b.aiKall, b.inputTokens, b.outputTokens, des(b.aiKostnadUsd, 4),
        b.opptak, des(b.lydTimer, 3), b.antallTegn, des(b.sonioxKostnadUsd, 4), des(b.sumUsd, 4), des(b.sumUsd * priser.usdNok),
      ].join(";")
    ),
  ]
  return new NextResponse("﻿" + linjer.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="legeassist-bruk-${mnd}-per-dag.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
