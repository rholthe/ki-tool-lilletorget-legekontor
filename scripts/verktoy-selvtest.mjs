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
 *
 * I tillegg sjekkes søket: at vanlige søk (synonymer, bøyninger, skrivefeil,
 * tastatur uten æøå) gir riktig verktøy blant de øverste treffene.
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
    "src/lib/verktoy/retningslinje.ts",
    "src/lib/verktoy/kalkulator.ts",
    "src/lib/verktoy/sok.ts",
    "src/lib/verktoy/retningslinjer/antibiotika-tillegg.ts",
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
const { INNEBYGDE_VERKTOY, INNEBYGDE_KALKULATORER, INNEBYGDE_OPPSLAG } = require(
  path.join(utMappe, "registry.js")
)
const { TILSTAND_TILLEGG } = require(
  path.join(utMappe, "retningslinjer", "antibiotika-tillegg.js")
)

// Retningslinjene kommer fra Helsedirektoratets API. Testen kjører på
// reservekopien (`npm run retningslinjer:reserve`), som er det samme API-et
// ga sist den ble hentet, oversatt av samme kode som serveren bruker.
const ANTIBIOTIKA = JSON.parse(
  fs.readFileSync(path.join(rot, "src/lib/verktoy/retningslinjer/antibiotika-reserve.json"), "utf8")
)
const RETNINGSLINJER = [ANTIBIOTIKA]
const OPPSLAG = [...INNEBYGDE_OPPSLAG, ...RETNINGSLINJER]
const FASIT = JSON.parse(fs.readFileSync(path.join(rot, "scripts/fasit/antibiotika-verifisert.json"), "utf8"))
const { beregnKalkulator, byggKalkulatorResultat } = require(
  path.join(utMappe, "kalkulator.js")
)
const { byggRetningslinjeResultat } = require(path.join(utMappe, "retningslinje.js"))
const {
  beregn,
  kjorTestkasus,
  standardSvar,
  byggResultat,
  formaterTilNotat,
  synkVerktoySeksjon,
} = require(path.join(utMappe, "beregn.js"))
const { sokOppslag, foreslaaOppslag, treffId, alleTreff, fagomraderFor, grupperEtterFagomrade } = require(path.join(utMappe, "sok.js"))

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
  //
  // For formelverktøy sier feltenes ytterpunkter ingenting om hvilke verdier
  // resultatet kan ta — MDI teller kun det høyeste av 8a/8b og 10a/10b, så
  // råsummen 60 er uoppnåelig, og NORRISK 2 gir en prosent, ikke en sum. Da
  // sveipes terskeltabellens eget spenn i stedet, som fortsatt fanger hull
  // mellom båndene. Referansekasusene dekker selve grenseverdiene.
  if (verktoy.beregning.type !== "ingen") {
    const [fra, til] =
      verktoy.beregning.type === "formel"
        ? [
            Math.min(...verktoy.terskler.map((t) => t.fra)),
            Math.max(...verktoy.terskler.map((t) => t.til)),
          ]
        : [sumGrense(verktoy, "min"), sumGrense(verktoy, "maks")]

    for (let sum = fra; sum <= til; sum++) {
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

/*
 * Retningslinjer fra Helsedirektoratet.
 *
 * Innholdet er ikke vårt, men oversettingen er det: en feil i den gir en dose
 * som ser riktig ut. Derfor sammenholdes reservekopien med de 18 tilstandene som
 * ble verifisert manuelt mot retningslinjen (scripts/fasit/), på preparat og
 * på hvert tall i dosen, i rekkefølge. Avviker en, har enten Helsedirektoratet
 * endret anbefalingen (oppdater fasiten etter å ha lest kilden) eller
 * oversettingen en feil.
 */
const RESERVE_ADVARSEL_DAGER = 180

const normEtikett = (s) =>
  s
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\bvaksne\b/g, "voksne")
    .replace(/haemophilues/g, "haemophilus")
    .replace(/\+/g, " og ")
    .replace(/[^\p{L}\p{N}<>/]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
const ordsett = (s) => new Set(normEtikett(s).split(" "))
function likhet(a, b) {
  const A = ordsett(a)
  const B = ordsett(b)
  const felles = [...A].filter((x) => B.has(x)).length
  return felles / new Set([...A, ...B]).size
}
const normPreparat = (s) => s.toLowerCase().replace(/cyklin/g, "syklin").replace(/sulfametoksasol/g, "sulfametoksazol")
// Tallene i dosen, i rekkefølge: «200 mg x 1 … 100 mg x 1 fra dag 2» → 200,1,100,1,2
const tall = (s) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => x.replace(",", ".")).join(",")
const navnNorm = (s) => s.replace(/[–—]/g, "-").toLowerCase()

for (const retningslinje of RETNINGSLINJER) {
  console.log(`\n${retningslinje.navn} (Helsedirektoratet, reservekopi)`)
  const forFeil = feil

  const alder = Math.floor((Date.now() - new Date(retningslinje.hentetAt).getTime()) / 86_400_000)
  sjekk(
    alder <= RESERVE_ADVARSEL_DAGER,
    `reservekopien er ${alder} dager gammel — kjør npm run retningslinjer:reserve og les diffen`
  )

  const tilstandIder = new Set(retningslinje.tilstander.map((t) => t.id))
  sjekk(tilstandIder.size === retningslinje.tilstander.length, "to tilstander deler samme id")
  for (const id of Object.keys(TILSTAND_TILLEGG)) {
    sjekk(tilstandIder.has(id), `antibiotika-tillegg.ts: ${id} finnes ikke lenger i retningslinjen`)
  }

  for (const tilstand of retningslinje.tilstander) {
    sjekk(/^https:\/\//.test(tilstand.url), `${tilstand.navn}: mangler lenke til kilden`)
    sjekk(tilstand.fagomrader.length > 0, `${tilstand.navn}: mangler fagområde`)
    sjekk(!Number.isNaN(new Date(tilstand.sistFagligOppdatert).getTime()), `${tilstand.navn}: mangler faglig dato`)
    const ider = tilstand.anbefalinger.map((a) => a.id)
    sjekk(new Set(ider).size === ider.length, `${tilstand.navn}: to anbefalinger deler samme id`)
    for (const a of tilstand.anbefalinger) {
      sjekk(a.regimer.length > 0 && a.regimer.every((r) => /\S/.test(r)), `${tilstand.navn}: tom behandlingslinje`)
      sjekk(!/&(gt|lt|amp|nbsp);/.test(a.etikett + a.regimer.join("")), `${tilstand.navn}: HTML-entitet i teksten`)
    }

    // Notatlinjen bygges av koden og skal aldri kunne bli tom eller halv
    if (ider.length > 0) {
      const r = byggRetningslinjeResultat(retningslinje, tilstand, [ider[0]], { id: "t" })
      sjekk(r.detaljer.length > 0, `${tilstand.navn}: gir tom notatlinje`)
      const en = synkVerktoySeksjon("S: subjektivt", [r])
      sjekk(en === synkVerktoySeksjon(en, [r]), `${tilstand.navn}: notat-synk er ikke idempotent`)
      if (tilstand === retningslinje.tilstander.find((t) => t.navn === "Akutt mediaotitt")) {
        console.log(`  ${formaterTilNotat(r).split("\n").map((l) => `    ${l}`).join("\n").trim()}`)
      }
    }
  }

  // Mot den manuelle verifiseringen
  let linjer = 0
  for (const fasit of Object.values(FASIT.tilstander)) {
    const t = retningslinje.tilstander.find((x) => navnNorm(x.navn) === navnNorm(fasit.navn))
    if (!sjekk(Boolean(t), `fasit: «${fasit.navn}» finnes ikke i retningslinjen`)) continue
    const ledige = [...t.anbefalinger]
    for (const f of fasit.linjer) {
      // Etiketten først, ellers den mest like (kilden har endret tegnsetting siden verifiseringen)
      let a = ledige.find((x) => x.gruppe === f.gruppe && normEtikett(x.etikett) === normEtikett(f.etikett))
      if (!a) {
        const kandidater = ledige
          .filter((x) => x.gruppe === f.gruppe)
          .map((x) => [likhet(x.etikett, f.etikett), x])
          .sort((p, q) => q[0] - p[0])
        if (kandidater[0]?.[0] >= 0.75) a = kandidater[0][1]
      }
      if (!sjekk(Boolean(a), `${fasit.navn}: fant ikke «${f.etikett}»`)) continue
      ledige.splice(ledige.indexOf(a), 1)
      linjer++
      sjekk(
        a.regimer.length === f.preparater.length,
        `${fasit.navn} «${f.etikett}»: ${a.regimer.length} preparater, fasit har ${f.preparater.length}`
      )
      f.preparater.forEach((preparat, i) => {
        const regime = a.regimer[i] ?? ""
        sjekk(
          normPreparat(regime).startsWith(normPreparat(preparat)),
          `${fasit.navn} «${f.etikett}»: «${regime}» er ikke ${preparat}`
        )
        // Tall etter preparatnavnet; navn som «B» i polymyksin B har ingen tall
        const dose = regime.slice(preparat.length).replace(/^\D*?(?=\d)/, "")
        sjekk(
          tall(dose).startsWith(tall(f.doser[i])),
          `${fasit.navn} «${f.etikett}»: dose «${dose}», fasit «${f.doser[i]}»`
        )
      })
    }
  }

  const antallLinjer = retningslinje.tilstander.reduce((n, t) => n + t.anbefalinger.length, 0)
  console.log(
    `  ${retningslinje.tilstander.length} tilstander, ${antallLinjer} behandlingslinjer · ` +
      `${linjer} linjer sammenholdt med manuell verifisering` +
      (feil === forFeil ? " · ✓ alle sjekker grønne" : "")
  )
}

/*
 * Kalkulatorer: datoregning er en klassisk feilkilde, og en termindato som
 * bommer med én dag ser helt riktig ut. Referansekasusene kjøres med fast
 * «i dag», så testen ikke gir ulikt svar fra dag til dag.
 */
const FAST_IDAG = new Date("2026-06-01T12:00:00Z")

for (const kalkulator of INNEBYGDE_KALKULATORER) {
  console.log(`\n${kalkulator.navn}`)
  const forFeil = feil

  for (const kasus of kalkulator.testkasus ?? []) {
    const res = beregnKalkulator(kalkulator, kasus.svar, FAST_IDAG)
    if (!sjekk(res !== null, `${kasus.navn}: gav ingen beregning`)) continue

    for (const [etikett, forventet] of Object.entries(kasus.forventet)) {
      const linje = res.linjer.find((l) => l.etikett === etikett)
      sjekk(Boolean(linje), `${kasus.navn}: fant ingen linje «${etikett}»`)
      if (linje) {
        sjekk(
          linje.verdi === forventet,
          `${kasus.navn}: ${etikett} ga «${linje.verdi}», forventet «${forventet}»`
        )
      }
    }

    const r = byggKalkulatorResultat(kalkulator, kasus.svar, res, { id: "t" })
    sjekk(r.detaljer.length > 0, `${kasus.navn}: gir tom notatlinje`)
    const en = synkVerktoySeksjon("S: subjektivt", [r])
    sjekk(en === synkVerktoySeksjon(en, [r]), `${kasus.navn}: notat-synk ikke idempotent`)
  }

  if (feil === forFeil) {
    const forste = kalkulator.testkasus?.[0]
    if (forste) {
      const res = beregnKalkulator(kalkulator, forste.svar, FAST_IDAG)
      const r = byggKalkulatorResultat(kalkulator, forste.svar, res, { id: "vis" })
      console.log("  " + formaterTilNotat(r).split("\n").join("\n  "))
    }
    console.log(
      `  ${(kalkulator.testkasus ?? []).length} referansekasus · ✓ alle sjekker grønne`
    )
  }
}

/*
 * Søk: hvert kasus er et søk legen kan tenkes å skrive, og id-en som må stå
 * blant de `topp` første treffene. Ett kasus per mekanisme — synonym,
 * bøyning, skrivefeil, manglende æøå, forkortelse, flere ord.
 */
/** Treff-id for en tilstand, slått opp på navn — id-ene er API-ets UUID-er. */
function tilstand(navn) {
  const t = ANTIBIOTIKA.tilstander.find((x) => navnNorm(x.navn) === navnNorm(navn))
  if (!t) throw new Error(`Ingen tilstand «${navn}» i reservekopien`)
  return `${ANTIBIOTIKA.id}:${t.id}`
}

const SOKEKASUS = [
  { sok: "ørebetennelse", id: tilstand("Akutt mediaotitt"), topp: 1 },
  { sok: "orebetennelse", id: tilstand("Akutt mediaotitt"), topp: 1 },
  { sok: "ørebetenelse", id: tilstand("Akutt mediaotitt"), topp: 1 },
  { sok: "halsbetennelsen", id: tilstand("Streptokokkhalsinfeksjon og skarlagensfeber"), topp: 1 },
  { sok: "vondt i halsen", id: tilstand("Streptokokkhalsinfeksjon og skarlagensfeber"), topp: 1 },
  { sok: "blærebetennelse", id: tilstand("Akutt cystitt hos ikke-gravid kvinne uten kompliserende forhold"), topp: 2 },
  { sok: "af", id: "chadsvasc", topp: 1 },
  { sok: "drypp", id: "chadsvasc", topp: 2 },
  { sok: "blodpropp", id: "wells-dvt", topp: 3 },
  { sok: "blodpropp", id: "wells-le", topp: 3 },
  { sok: "hoven legg", id: "wells-dvt", topp: 1 },
  { sok: "trist", id: "madrs", topp: 2 },
  { sok: "depresjon", id: "mdi", topp: 2 },
  { sok: "glemsom", id: "klokketest", topp: 1 },
  { sok: "alzheimer", id: "klokketest", topp: 1 },
  { sok: "gravid", id: "svangerskap", topp: 1 },
  { sok: "termn", id: "svangerskap", topp: 1 },
  { sok: "kolesterol", id: "norrisk2", topp: 1 },
  { sok: "vondt i kneet", id: "kne", topp: 1 },
  { sok: "korsband", id: "kne", topp: 1 },
  { sok: "frossen skulder", id: "skulder", topp: 1 },
  { sok: "blodforgiftning", id: "qsofa", topp: 3 },
  { sok: "slapp baby", id: "pevs", topp: 1 },
  { sok: "chads", id: "chadsvasc", topp: 1 },
  { sok: "cha2ds2", id: "chadsvasc", topp: 1 },
  { sok: "flått", id: tilstand("Borreliose – erytema migrans"), topp: 1 },
  { sok: "hjernehinnebetennelse", id: tilstand("Bakteriell meningitt"), topp: 1 },
  // Fagområdene er søkbare
  { sok: "psykiatri", id: "madrs", topp: 2 },
  { sok: "eldre", id: "klokketest", topp: 2 },
  { sok: "legevakt", id: "qsofa", topp: 6 },
]

console.log("\nSøk")
{
  const forFeil = feil
  for (const { sok, id, topp } of SOKEKASUS) {
    const ider = sokOppslag(sok, OPPSLAG).map(treffId)
    const plass = ider.indexOf(id)
    sjekk(
      plass !== -1 && plass < topp,
      `«${sok}»: ${id} på plass ${plass === -1 ? "–" : plass + 1}, forventet topp ${topp} (fikk ${ider.slice(0, 4).join(", ") || "ingen"})`
    )
  }
  // Korte forkortelser skal ikke slå ut inni andre ord
  sjekk(
    sokOppslag("le", OPPSLAG).every((t) => treffId(t) !== tilstand("Akutt sinusitt")),
    "«le» treffer sinusitt — korte ord skal kreve ordstart"
  )
  sjekk(sokOppslag("xyzzyq", OPPSLAG).length === 0, "meningsløst søk gir treff")
  // Et oppslag uten fagområde ville vært usynlig i oversikten
  for (const t of alleTreff(OPPSLAG)) {
    sjekk(fagomraderFor(t).length > 0, `${treffId(t)} mangler fagområde`)
  }
  const iOversikt = new Set(grupperEtterFagomrade(OPPSLAG).flatMap(([, l]) => l.map(treffId)))
  sjekk(iOversikt.size === alleTreff(OPPSLAG).length, "ikke alle oppslag vises i oversikten")
  sjekk(
    foreslaaOppslag("Pasienten har vridd kneet og har korsbandskade", OPPSLAG).some(
      (f) => treffId(f.treff) === "kne"
    ),
    "forslag fra transkript fanger ikke «vridd kneet»"
  )
  if (feil === forFeil) console.log(`  ${SOKEKASUS.length} søk · ✓ alle sjekker grønne`)
}

console.log(
  feil === 0
    ? `\n✓ ${INNEBYGDE_VERKTOY.length} verktøy, ${INNEBYGDE_KALKULATORER.length} kalkulator(er) og ${RETNINGSLINJER.length} retningslinje(r) — alle sjekker grønne`
    : `\n✗ ${feil} sjekk(er) feilet`
)
process.exit(feil === 0 ? 0 : 1)
