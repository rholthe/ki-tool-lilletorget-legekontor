// Viser de utfyllbare feltene i en PDF-mal: navn, type, ruter, størrelse og beregnet plass i tegn.
// Bruk: node scripts/skjema/les-pdf.mjs <fil.pdf>     (se docs/legge-inn-skjema.md)
import { readFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { join } from "node:path"

export function kompilerPdfLib() {
  // Inne i node_modules, så den kompilerte koden finner pdf-lib
  const ut = join(process.cwd(), "node_modules", ".cache", "skjema-pdf")
  mkdirSync(ut, { recursive: true })
  try {
    execFileSync("npx", ["tsc", "src/lib/skjema/pdf.ts", "--outDir", ut, "--module", "commonjs", "--moduleResolution", "node10", "--target", "es2022", "--skipLibCheck", "--ignoreDeprecations", "6.0"], { stdio: "pipe" })
  } catch (e) {
    // tsc melder typefeil fra andre filer, men skriver likevel ut koden
    if (!e.stdout?.length && !e.stderr?.length) throw e
  }
  return createRequire(join(process.cwd(), "package.json"))(join(ut, "pdf.js"))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { lesPdfMal, plassForMaal } = kompilerPdfLib()
  const info = await lesPdfMal(new Uint8Array(readFileSync(process.argv[2])))
  console.log(`${info.antallSider} sider, roterte: ${JSON.stringify(info.roterteSider)}, ${info.felter.length} felt`)
  for (const f of info.felter)
    console.log(
      JSON.stringify({ navn: f.navn, type: f.type, flerlinje: f.flerlinje || undefined, valg: f.valg.length ? f.valg : undefined, side: f.side === null ? null : f.side + 1, hjelp: f.hjelp !== f.navn ? f.hjelp : undefined, maksLengde: f.maksLengde ?? undefined, plass: plassForMaal(info, { felt: f.navn }) ?? undefined }),
    )
}
