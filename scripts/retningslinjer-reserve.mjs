/**
 * Henter antibiotikaretningslinjen fra Helsedirektoratets API og lagrer den
 * som reservekopi: `npm run retningslinjer:reserve`
 *
 * Reservekopien brukes når serveren ennå ikke har hentet noe, eller API-et er
 * nede ved første henting. Den er også grunnlaget for selvtesten, som
 * sammenholder dosene med de manuelt verifiserte i `scripts/fasit/`.
 *
 * Git-diffen av reservekopien viser hva Helsedirektoratet har endret siden sist.
 * Les den før du committer.
 */

import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const utMappe = path.join(rot, "node_modules", ".cache", "retningslinjer-reserve")
const reserve = path.join(rot, "src", "lib", "verktoy", "retningslinjer", "antibiotika-reserve.json")

function lesNokkel() {
  if (process.env.HELSEDIR_API_KEY) return process.env.HELSEDIR_API_KEY
  const env = fs.readFileSync(path.join(rot, ".env"), "utf8")
  const linje = env.split(/\r?\n/).find((l) => l.startsWith("HELSEDIR_API_KEY="))
  const verdi = linje?.slice("HELSEDIR_API_KEY=".length).trim().replace(/^["']|["']$/g, "")
  if (!verdi) throw new Error("HELSEDIR_API_KEY mangler i miljøet og i .env")
  return verdi
}

fs.rmSync(utMappe, { recursive: true, force: true })
execFileSync(
  process.execPath,
  [
    path.join(rot, "node_modules", "typescript", "bin", "tsc"),
    "src/lib/verktoy/retningslinjer/antibiotika-hapi.ts",
    "--outDir", utMappe,
    "--module", "commonjs",
    "--target", "es2020",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--skipLibCheck",
  ],
  { cwd: rot, stdio: "inherit" }
)

const require = createRequire(import.meta.url)
const { hentTre } = require(path.join(utMappe, "hapi", "hent.js"))
const { byggAntibiotika, ANTIBIOTIKA_ROT } = require(
  path.join(utMappe, "verktoy", "retningslinjer", "antibiotika-hapi.js")
)

const start = Date.now()
const tre = await hentTre(ANTIBIOTIKA_ROT, { nokkel: lesNokkel() })
const retningslinje = byggAntibiotika(tre, new Date().toISOString())
fs.writeFileSync(reserve, JSON.stringify(retningslinje, null, 1) + "\n")

const linjer = retningslinje.tilstander.reduce((n, t) => n + t.anbefalinger.length, 0)
console.log(
  `✓ ${retningslinje.tilstander.length} tilstander, ${linjer} behandlingslinjer ` +
    `(faglig oppdatert ${retningslinje.kilde.sistRevidert.slice(0, 10)}) på ${Math.round((Date.now() - start) / 1000)} s`
)
console.log(`  → ${path.relative(rot, reserve)}`)
