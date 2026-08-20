/**
 * Selvtest for kliniske verktøy: `node scripts/verktoy-selvtest.mjs`
 *
 * Prosjektet har ingen testrunner, og poengsummene i verktøyene er nettopp det
 * som ikke får være feil. Skriptet kompilerer `src/lib/verktoy` med tsc til en
 * cache-mappe og kjører tre sjekker mot hver definisjon:
 *
 *   1. Referansekasus (`testkasus`) gir forventet sum — og forventet klasse der
 *      kasuset oppgir den, slik at terskler og overstyringer også dekkes.
 *   2. Terskeldekning: hver oppnåelige sum treffer en terskel, ellers ville
 *      skjemaet vist en sum uten tolkning.
 *   3. Notat-synk er idempotent og legger seksjonen foran `--- OCR ---`.
 */

import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const utMappe = path.join(rot, "node_modules", ".cache", "verktoy-selvtest")

fs.rmSync(utMappe, { recursive: true, force: true })
// Kaller tsc direkte som JS-fil — `npx` er ikke spawnbart uten shell på Windows
execFileSync(
  process.execPath,
  [
    path.join(rot, "node_modules", "typescript", "bin", "tsc"),
    "src/lib/verktoy/registry.ts",
    "src/lib/verktoy/beregn.ts",
    "--outDir",
    utMappe,
    "--module",
    "commonjs",
    "--target",
    "es2020",
    "--moduleResolution",
    "node",
    "--skipLibCheck",
  ],
  { cwd: rot, stdio: "inherit" }
)

const require = createRequire(import.meta.url)
const { INNEBYGDE_VERKTOY } = require(path.join(utMappe, "registry.js"))
const {
  beregn,
  kjorTestkasus,
  standardSvar,
  byggResultat,
  formaterTilNotat,
  synkVerktoySeksjon,
} = require(path.join(utMappe, "beregn.js"))

let feil = 0

function sjekk(ok, melding) {
  if (!ok) {
    feil++
    console.log(`  ✗ ${melding}`)
  }
  return ok
}

/**
 * Ytterpunktene for en ferdig utfylt skala. Et `ja_nei`-felt kan stå usjekket og
 * bidra med 0, mens et `valg`-felt alltid har et valgt alternativ — Shulman-skalaen
 * starter for eksempel på 1, ikke på 0.
 */
function sumGrense(verktoy, retning) {
  const velg = retning === "maks" ? Math.max : Math.min
  let sum = 0
  for (const seksjon of verktoy.seksjoner) {
    for (const felt of seksjon.felter) {
      if (felt.type === "ja_nei") sum += velg(0, felt.poeng)
      if (felt.type === "valg" && felt.alternativer.length > 0) {
        sum += velg(...felt.alternativer.map((a) => a.poeng))
      }
    }
  }
  if (retning === "maks" && verktoy.beregning.maks !== undefined) {
    return Math.min(sum, verktoy.beregning.maks)
  }
  return sum
}

for (const verktoy of INNEBYGDE_VERKTOY) {
  console.log(`\n${verktoy.navn}`)
  const forFeil = feil

  // 1. Referansekasus
  const kasus = kjorTestkasus(verktoy)
  if (verktoy.beregning.type !== "ingen") {
    sjekk(kasus.length > 0, "har ingen referansekasus")
  }
  for (const k of kasus) {
    sjekk(
      k.ok,
      `${k.navn}: forventet ${k.forventet}${
        k.forventetKlasse ? ` / «${k.forventetKlasse}»` : ""
      }, fikk ${k.faktisk}${k.faktiskKlasse !== undefined ? ` / «${k.faktiskKlasse}»` : ""}`
    )
  }

  // 2. Terskeldekning
  if (verktoy.beregning.type !== "ingen") {
    for (let sum = sumGrense(verktoy, "min"); sum <= sumGrense(verktoy, "maks"); sum++) {
      sjekk(
        verktoy.terskler.some((t) => sum >= t.fra && sum <= t.til),
        `sum ${sum} treffer ingen terskel`
      )
    }
  }

  // 3. Notat-synk: idempotent og plassert foran OCR-seksjonen
  const resultat = byggResultat(verktoy, standardSvar(verktoy), { id: "test" })
  const notat = "S: subjektivt\n\n--- OCR ---\nlest tekst"
  const en = synkVerktoySeksjon(notat, [resultat])
  const to = synkVerktoySeksjon(en, [resultat])
  sjekk(en === to, "synkVerktoySeksjon er ikke idempotent")
  sjekk(
    en.indexOf("--- KLINISKE VERKTØY ---") < en.indexOf("--- OCR ---"),
    "verktøyseksjonen havner ikke foran OCR-seksjonen"
  )
  sjekk(
    synkVerktoySeksjon(en, []) === "S: subjektivt\n\n--- OCR ---\nlest tekst",
    "tomt resultatsett fjerner ikke seksjonen rent"
  )

  // Vis den ferdige notatlinjen for et fylt skjema, som lesbar kontroll
  if (kasus.length > 0) {
    const fylt = { ...standardSvar(verktoy), ...verktoy.testkasus[kasus.length - 1].svar }
    const r = byggResultat(verktoy, fylt, { id: "vis" })
    const b = beregn(verktoy, fylt)
    console.log(
      `  sum ${b.sum ?? "—"}${b.klasse ? ` · ${b.klasse}` : ""}${b.overstyrt ? " (overstyrt)" : ""}`
    )
    console.log(
      formaterTilNotat(r)
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n")
    )
  }

  if (feil === forFeil) console.log("  ✓ alle sjekker grønne")
}

console.log(
  feil === 0
    ? `\n✓ ${INNEBYGDE_VERKTOY.length} verktøy — alle sjekker grønne`
    : `\n✗ ${feil} sjekk(er) feilet`
)
process.exit(feil === 0 ? 0 : 1)
