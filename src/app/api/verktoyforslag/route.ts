import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk"
import { hentSystemSetting, standardModell, standardRegion } from "@/lib/admin"
import { hentStagingOverrides, byggVerktoyforslagStaging } from "@/lib/staging-server"
import { forslagKandidater } from "@/lib/verktoy/sok"

/**
 * AI-forslag om hvilke kliniske verktøy legen bør åpne.
 *
 * Til forskjell fra `/api/chat` er dette ett kort, strukturert svar — ikke en
 * samtale. Derfor vanlig JSON og ikke SSE: å strømme svaret for så å samle det
 * igjen bare for å parse det ville vært omvei.
 *
 * To ting holder dette trygt:
 *
 * 1. **Kandidatlisten bygges her, ikke av klienten.** Modellen får kun se id-er
 *    fra registeret, og nøyaktig samme liste brukes til å validere svaret. En
 *    manipulert klient kan derfor ikke få appen til å «foreslå» noe som ikke
 *    finnes.
 * 2. **Modellen foreslår, den regner ikke.** Den peker på hvilket verktøy legen
 *    bør åpne; all poengsummering skjer fortsatt deterministisk i `beregn.ts`.
 *
 * Ingen pasientinnhold logges.
 */

const MAKS_FORSLAG = 3
const MAKS_BEGRUNNELSE = 120

interface Body {
  transkript?: string
  kontekst?: string
  tilleggsinfo?: string
}

export interface VerktoyForslag {
  id: string
  begrunnelse: string
}

async function lagBedrockKlient() {
  const region = await hentSystemSetting("bedrock_region", standardRegion())
  return new AnthropicBedrock({
    awsAccessKey: process.env.BEDROCK_API_KEY ?? "",
    awsSecretKey: process.env.BEDROCK_SECRET_KEY ?? "",
    awsRegion: region,
  })
}

/**
 * Plukker ut JSON-objektet fra svaret. Modellen er bedt om ren JSON, men et
 * ledsagende «Her er forslagene:» skal ikke velte forslagene.
 */
function lesForslag(rå: string, gyldige: Set<string>): VerktoyForslag[] {
  const start = rå.indexOf("{")
  const slutt = rå.lastIndexOf("}")
  if (start === -1 || slutt <= start) return []

  let parset: unknown
  try {
    parset = JSON.parse(rå.slice(start, slutt + 1))
  } catch {
    return []
  }

  const liste = (parset as { forslag?: unknown })?.forslag
  if (!Array.isArray(liste)) return []

  const sett = new Set<string>()
  const ut: VerktoyForslag[] = []

  for (const rad of liste) {
    const id = (rad as { id?: unknown })?.id
    // Alt som ikke står i kandidatlisten forkastes — modellen får ikke finne opp verktøy
    if (typeof id !== "string" || !gyldige.has(id) || sett.has(id)) continue
    sett.add(id)

    const begrunnelse = (rad as { begrunnelse?: unknown })?.begrunnelse
    ut.push({
      id,
      begrunnelse:
        typeof begrunnelse === "string" ? begrunnelse.trim().slice(0, MAKS_BEGRUNNELSE) : "",
    })
    if (ut.length === MAKS_FORSLAG) break
  }

  return ut
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  if (!process.env.BEDROCK_API_KEY || !process.env.BEDROCK_SECRET_KEY) {
    return NextResponse.json(
      { feil: "Bedrock-nøkler mangler. Sett BEDROCK_API_KEY og BEDROCK_SECRET_KEY i .env" },
      { status: 500 }
    )
  }

  const body: Body = await req.json()

  const deler: string[] = []
  if (body.kontekst?.trim()) deler.push(`**Kontekst:**\n${body.kontekst}`)
  if (body.tilleggsinfo?.trim()) deler.push(`**Tilleggsopplysninger:**\n${body.tilleggsinfo}`)
  if (body.transkript?.trim()) deler.push(`**Transkript:**\n${body.transkript}`)

  // Uten innhold finnes det ingenting å foreslå ut fra — spar kallet
  if (deler.length === 0) {
    return NextResponse.json({ forslag: [] })
  }

  const kandidater = forslagKandidater()
  const gyldige = new Set(kandidater.map((k) => k.id))
  const kandidatTekst = kandidater
    .map((k) => `- ${k.id} — ${k.navn}: ${k.beskrivelse}`)
    .join("\n")

  const overrides = await hentStagingOverrides()
  const systemPrompt = byggVerktoyforslagStaging(
    kandidatTekst,
    deler.join("\n\n---\n\n"),
    overrides
  )

  try {
    const model = await hentSystemSetting("bedrock_model", standardModell())
    const client = await lagBedrockKlient()

    const svar = await client.messages.create({
      model,
      max_tokens: 500,
      system: systemPrompt,
      // Ingen forhåndsutfylt assistant-melding for å tvinge fram JSON: Bedrock
      // svarer «This model does not support assistant message prefill».
      // `lesForslag` plukker JSON ut av svaret i stedet.
      messages: [{ role: "user", content: "Foreslå relevante kliniske verktøy." }],
    })

    const tekst = svar.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")

    return NextResponse.json({ forslag: lesForslag(tekst, gyldige) })
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Ukjent Bedrock-feil"
    return NextResponse.json({ feil: melding, forslag: [] }, { status: 502 })
  }
}
