// Kontrollerer en skjemadefinisjon mot PDF-malen, lager en prøveutfylling, og legger skjemaet inn i databasen.
// Bruk (se docs/legge-inn-skjema.md):
//   node scripts/skjema/legg-inn.mjs <definisjon.mjs> <mal.pdf>            kontroll + prøve-PDF, skriver ingenting
//   node scripts/skjema/legg-inn.mjs <definisjon.mjs> <mal.pdf> --skriv    legger inn som INAKTIVT skjema
// Databasen er den samme i dev og prod. Skriptet oppdaterer aldri et skjema som finnes fra før.
import "dotenv/config"
import { readFileSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { basename, resolve } from "node:path"
import assert from "node:assert/strict"
import { kompilerPdfLib } from "./les-pdf.mjs"

const [defFil, pdfFil, flagg] = process.argv.slice(2)
if (!defFil || !pdfFil) throw new Error("Bruk: legg-inn.mjs <definisjon.mjs> <mal.pdf> [--skriv]")
const def = await import(resolve(defFil))
const { navn, beskrivelse = null, prompt, felter, kategori } = def
const pdf = readFileSync(pdfFil)
const { lesPdfMal, fyllPdf, plassForMaal } = kompilerPdfLib()

// ─── Kontroll ───────────────────────────────────────────────────────────────
const KILDER = ["ai", "manuell", "pasient.navn", "pasient.fornavn", "pasient.etternavn", "pasient.fnr", "pasient.fodt", "pasient.adresse", "pasient.postnr", "pasient.poststed", "lege.navn", "lege.fornavn", "lege.etternavn", "lege.hpr", "dato.idag"]
const info = await lesPdfMal(new Uint8Array(pdf))
const iPdf = new Map(info.felter.map((f) => [f.navn, f]))
const brukt = new Set()
const ider = new Set()
assert.ok(navn && navn.length <= 200 && prompt && kategori, "navn, prompt og kategori må være satt")
for (const f of felter) {
  const hvor = `felt ${f.id} («${f.etikett}»)`
  assert.match(f.id, /^[a-zA-Z0-9_-]{1,40}$/, hvor)
  assert.ok(!ider.has(f.id), `${hvor}: id brukt to ganger`)
  ider.add(f.id)
  assert.ok(f.etikett && f.etikett.length <= 500, hvor)
  assert.ok(["tekst", "flerlinje", "avkrysning"].includes(f.type), hvor)
  assert.ok(KILDER.includes(f.kilde), `${hvor}: ukjent kilde ${f.kilde}`)
  assert.ok((f.instruks ?? "").length <= 2000 && (f.pridokTekst ?? "").length <= 500 && (f.seksjon ?? "").length <= 200, hvor)
  if (f.type === "avkrysning") assert.ok(f.kilde === "ai" || f.kilde === "manuell", `${hvor}: avkrysning kan bare ha ai eller manuell`)
  if (f.kilde !== "ai") assert.ok(!f.instruks, `${hvor}: instruks brukes bare når kilden er ai`)
  for (const m of [f.pdf, f.pdfNei]) {
    if (!m?.felt) continue
    const p = iPdf.get(m.felt)
    assert.ok(p, `${hvor}: PDF-feltet «${m.felt}» finnes ikke`)
    brukt.add(m.felt)
    if (f.type === "avkrysning") {
      assert.ok(p.type === "avkrysning" || p.type === "radio" || p.type === "nedtrekk", `${hvor}: «${m.felt}» er ikke en avkrysning`)
      // Felt med flere ruter (radiogruppe, eller boks med «Nei» og «Ja») MÅ ha valg, ellers krysses feil rute
      if (p.type !== "avkrysning") assert.ok(m.valg && p.valg.includes(m.valg), `${hvor}: «${m.felt}» krever valg, ett av ${p.valg.join("/")}`)
    } else assert.ok(p.type === "tekst" || p.type === "nedtrekk", `${hvor}: «${m.felt}» er ikke et tekstfelt`)
  }
  if (f.type !== "avkrysning" && f.pdf?.felt) {
    const plass = plassForMaal(info, f.pdf)
    if (f.maksTegn !== (plass ?? undefined)) console.log(`  obs: ${hvor} har maksTegn ${f.maksTegn}, utregnet plass er ${plass}`)
  }
}
const ubrukt = info.felter.filter((f) => !brukt.has(f.navn)).map((f) => f.navn)
console.log(`Kontroll ok: ${felter.length} felt, ${brukt.size} av ${info.felter.length} PDF-felt koblet.`)
if (ubrukt.length) console.log("PDF-felt som ikke er koblet:", ubrukt)

// ─── Prøveutfylling: annenhver avkrysning ja/nei, så begge rutene kan kontrolleres ──
const v = {}
let n = 0
for (const f of felter) {
  if (f.type === "avkrysning") v[f.id] = n++ % 2 === 0
  else if (f.kilde === "pasient.fnr") v[f.id] = "01020312345"
  else if (f.kilde === "dato.idag") v[f.id] = "01.02.2026"
  else v[f.id] = `Prøve æøå: ${f.etikett}. `.repeat(8).slice(0, f.maksTegn ?? 120)
}
const r = await fyllPdf(new Uint8Array(pdf), felter, v, { tittel: navn, undertittel: "Prøveutfylling" })
const prove = resolve("node_modules/.cache/skjema-pdf/prove.pdf")
writeFileSync(prove, r.pdf)
console.log(`Prøve: ${r.fylt} felt fylt, mangler ${JSON.stringify(r.mangler)}, for langt ${JSON.stringify(r.forLangt)}, på ark ${JSON.stringify(r.paaArk)}`)
console.log(`  → ${prove}  (se på sidene: pdftoppm -r 70 -png <fil> <prefiks>)`)
console.log("  Avkrysninger i rekkefølge:", felter.filter((f) => f.type === "avkrysning").map((f) => `${f.id}=${v[f.id] ? "Ja" : "Nei"}`).join(" "))
assert.deepEqual(r.mangler, [], "noen felt fant ikke plassen sin i PDF-en")

if (flagg !== "--skriv") {
  console.log("Ingenting skrevet. Kjør med --skriv når prøve-PDF-en er sett over.")
  process.exit(0)
}

// ─── Skriv ──────────────────────────────────────────────────────────────────
const { default: mariadb } = await import("mariadb")
const u = new URL(process.env.DATABASE_URL)
const c = await mariadb.createConnection({ host: u.hostname, port: +u.port || 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1) })
try {
  const finnes = await c.query("select id from Skjema where navn = ?", [navn])
  assert.equal(finnes.length, 0, `Skjemaet «${navn}» finnes fra før — rett det på /admin/skjema`)
  const [kat] = await c.query("select id from SkjemaKategori where navn = ?", [kategori])
  assert.ok(kat, `Kategorien «${kategori}» finnes ikke`)
  // Samme oppretter som de andre skjemaene (en admin-bruker)
  const [forrige] = await c.query("select opprettetAv from Skjema where opprettetAv is not null order by createdAt desc limit 1")
  const id = "c" + BigInt("0x" + randomBytes(16).toString("hex")).toString(36).padStart(24, "0").slice(0, 24)
  await c.beginTransaction()
  try {
    await c.query("insert into Skjema (id,kategoriId,navn,beskrivelse,prompt,felter,aktiv,opprettetAv,createdAt,updatedAt) values (?,?,?,?,?,?,0,?,utc_timestamp(3),utc_timestamp(3))", [id, kat.id, navn, beskrivelse, prompt, JSON.stringify(felter), forrige?.opprettetAv ?? null])
    await c.query("insert into SkjemaPdf (skjemaId,filnavn,storrelse,data,updatedAt) values (?,?,?,?,utc_timestamp(3))", [id, basename(pdfFil).slice(0, 200), pdf.length, pdf])
    await c.commit()
  } catch (e) {
    await c.rollback()
    throw e
  }
  console.log(`Lagt inn som INAKTIVT skjema ${id}. Se over og aktiver på /admin/skjema.`)
} finally {
  await c.end()
}
