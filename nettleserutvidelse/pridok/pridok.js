// Innholdsskript i Pridok (epj3.pridok.no). Tre oppgaver:
//  1. Dagsnotat: finner åpne notater ut fra feltetikettene, beskriver dem (dokumenttype,
//     pasientnavn, fødselsdato, om feltene har tekst) og fyller det notatet legen velger.
//  2. Pasient: leser navn, fødselsdato, fødselsnummer og adresse fra journalhodet.
//  3. Skjema: finner og fyller skjemafelt ut fra tekstene LegeAssist sender.
// Gul lapp røres aldri. Dokumenter låses aldri herfra — Pridok autolagrer, og legen
// ser over teksten.
//
// Pridok er AngularJS (ng-model på <textarea>). Det holder ikke å sette .value:
// modellen oppdateres først når et «input»-event fyrer.
//
// Hvert åpne dokument er et eget <form id="docform<uuid>">, så form-id-en skiller
// to notater i samme fane (venstre og høyre side). Dokumenthodet har
// .document-name («Dagsnotat») og .document-subname («Ragnar  Holthe, 14.10.75»).

const MAAL = {
  anamnese: { etikett: "Anamnese", treff: (t) => /^anamnese\b/i.test(t) },
  funn: { etikett: "Funn", treff: (t) => /^funn$/i.test(t) },
  vurdering: { etikett: "Vurdering", treff: (t) => /^vurdering$/i.test(t) },
  tiltak: { etikett: "Tiltak", treff: (t) => /^tiltak$/i.test(t) },
}
const ALLE = Object.keys(MAAL)

function tekst(el) {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim()
}

function synlig(el) {
  return el.getClientRects().length > 0
}

/** Dokumentet et felt hører til. Det ytre docform-et, ikke nærmeste <form>: AngularJS kan
 * legge et eget (navnløst) skjema rundt hvert felt, og da havnet de fire feltene i hver
 * sin gruppe og ingen notater ble funnet. */
function dokumentFor(ta) {
  return ta.closest('form[id^="docform"]') ?? ta.closest("form")
}

function pasient(form) {
  let raa = tekst(form?.querySelector(".document-subname"))
  if (!raa) {
    const hode = [...document.querySelectorAll("button.journalheader")].find(synlig)
    raa = tekst(hode)
  }
  const m = raa.match(/^(.*?),\s*(\d{1,2}\.\d{1,2}\.\d{2,4})$/)
  return m ? { navn: m[1], fodt: m[2] } : { navn: raa || null, fodt: null }
}

/** Synlige notater med alle fire felt. Låste (skrivebeskyttede) telles for seg. */
function finnNotater() {
  const dokumenter = new Map() // dokId → { form, felt: { anamnese: [textarea…], … } }
  for (const legend of document.querySelectorAll(".legend")) {
    const felt = ALLE.find((k) => MAAL[k].treff(tekst(legend)))
    if (!felt) continue
    const boks = legend.closest("pddata") ?? legend.parentElement
    const ta = boks?.querySelector(".fielddata textarea")
    if (!ta || !synlig(ta)) continue
    const form = dokumentFor(ta)
    const dokId = form?.id || "dokument"
    if (!dokumenter.has(dokId)) {
      dokumenter.set(dokId, { form, felt: { anamnese: [], funn: [], vurdering: [], tiltak: [] } })
    }
    dokumenter.get(dokId).felt[felt].push(ta)
  }

  const notater = []
  let laaste = 0
  for (const [dokId, { form, felt }] of dokumenter) {
    if (ALLE.some((k) => felt[k].length === 0)) {
      // Kun antall og feltnavn, aldri innhold — til feilsøking når Pridok endrer markupen.
      console.debug("[LegeAssist] ufullstendig notat", dokId, Object.fromEntries(ALLE.map((k) => [k, felt[k].length])))
      continue
    }
    const redigerbare = Object.fromEntries(
      ALLE.map((k) => [k, felt[k].find((ta) => !ta.disabled && !ta.readOnly)]),
    )
    if (ALLE.some((k) => !redigerbare[k])) {
      laaste++
      continue
    }
    notater.push({ dokId, form, felt: redigerbare })
  }
  return { notater, laaste }
}

function beskriv(notat) {
  const p = pasient(notat.form)
  return {
    dokId: notat.dokId,
    tittel: tekst(notat.form?.querySelector(".document-name > div")) || "Notat",
    navn: p.navn,
    fodt: p.fodt,
    harInnhold: ALLE.filter((k) => notat.felt[k].value.trim()).map((k) => MAAL[k].etikett),
  }
}

function settTekst(ta, verdi) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set
  ta.focus()
  setter.call(ta, verdi)
  ta.dispatchEvent(new Event("input", { bubbles: true }))
  ta.dispatchEvent(new Event("change", { bubbles: true }))
  ta.blur()
}

function fyll(notat, felter, modus) {
  const aktuelle = ALLE.filter((k) => felter[k].trim())

  if (modus === "tom") {
    const harInnhold = aktuelle.filter((k) => notat.felt[k].value.trim())
    if (harInnhold.length) {
      return { ok: false, grunn: "har-innhold", felt: harInnhold.map((k) => MAAL[k].etikett) }
    }
  }

  for (const k of aktuelle) {
    const ta = notat.felt[k]
    const eksisterende = ta.value.replace(/\s+$/, "")
    const ny =
      modus === "legg-til" && eksisterende ? `${eksisterende}\n\n${felter[k].trim()}` : felter[k].trim()
    settTekst(ta, ny)
  }

  if (aktuelle.length) notat.felt[aktuelle[0]].scrollIntoView({ block: "center" })
  return { ok: true, fylt: aktuelle.map((k) => MAAL[k].etikett) }
}

// ─── Pasient (personalia fra journalhodet) ───────────────────────────────────
//
// Journalhodet er <button class="journalheader">Navn, dd.mm.åååå</button> fulgt av
// bokser (.box-contextitem) der `title` sier hva boksen er: «Adresse: …», «FNR: …».
// Bare navn, fødselsdato, fødselsnummer og adresse leses. Ingenting lagres her.

function lesPasienter() {
  const pasienter = []
  for (const hode of document.querySelectorAll("button.journalheader")) {
    if (!synlig(hode)) continue
    const m = tekst(hode).match(/^(.*?),\s*(\d{1,2}\.\d{1,2}\.\d{2,4})$/)
    if (!m) continue
    const p = { navn: m[1], fodt: m[2], fnr: null, adresse: null, postnr: null, poststed: null }
    const rot = hode.closest(".submain") ?? hode.parentElement
    for (const boks of rot?.querySelectorAll(".box-contextitem[title]") ?? []) {
      const t = (boks.getAttribute("title") ?? "").replace(/\s+/g, " ").trim()
      const fnr = t.match(/^(?:FNR|DNR|D-nr)\.?:\s*(\d{6})\s*-?\s*(\d{5})$/i)
      if (fnr) p.fnr = fnr[1] + fnr[2]
      const adr = t.match(/^Adresse:\s*(.+)$/i)
      if (adr) {
        const d = adr[1].match(/^(.*?),\s*(\d{4})\s+([^,]+)/)
        if (d) {
          p.adresse = d[1].trim()
          p.postnr = d[2]
          p.poststed = d[3].trim()
        } else {
          p.adresse = adr[1].trim()
        }
      }
    }
    if (!pasienter.some((x) => x.navn === p.navn && x.fodt === p.fodt)) pasienter.push(p)
  }
  return pasienter
}

// ─── Skjema (generisk utfylling) ─────────────────────────────────────────────
//
// Et skjemafelt i Pridok er et <pddata>. Det kjennes igjen på teksten sin, som står
// i .legend, i feltets placeholder («Hvis ja, oppgi når:»), i .chktxt på en
// avkrysningsknapp eller i .tristate-caption på et ja/nei-felt.
//
// Tre slags felt fylles:
//  - tekst:    <textarea> og <input type="text">
//  - kryss:    <button class="b-check">, av eller på (.chkbx .fa-check = på, .fa-tag = av)
//  - tristate: <div class="tristate"> med knappene Ja (.checkyes) og Nei (.checkno)
// Oppslagsfelt (dato, poststed, ICPC — <input class="stretch"> med nedtrekksknapp) hoppes
// over: de må velges fra Pridoks egen liste, og tekst skrevet rett inn blir ikke en gyldig verdi. Element-id-ene (id="203") er løpende tellere og
// brukes ikke. LegeAssist sender tekstene den leter etter; hvilke felt et skjema har,
// står i skjemadefinisjonen der, ikke her.

function norm(t) {
  return (t ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim().replace(/:$/, "").trim().toLowerCase()
}

function settVerdi(el, verdi) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set
  el.focus()
  setter.call(el, verdi)
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
  el.blur()
}

/** Tilstanden til et avkrysnings- eller ja/nei-felt: true, false eller null (ubesvart/ukjent). */
function lesKryss(felt) {
  if (felt.slag === "tristate") {
    const [ja, nei] = felt.el.querySelectorAll("button.btn-tristate")
    if (ja?.classList.contains("checkyes")) return true
    if (nei?.classList.contains("checkno")) return false
    return null
  }
  if (felt.el.querySelector(".chkbx .fa-check")) return true
  if (felt.el.querySelector(".chkbx .fa-tag")) return false
  return null
}

/** Setter ja/nei. Klikker bare når tilstanden avviker, og sier fra om klikket ikke virket. */
function settKryss(felt, verdi) {
  const naa = lesKryss(felt)
  if (felt.slag === "tristate") {
    if (naa === verdi) return true
    const [ja, nei] = felt.el.querySelectorAll("button.btn-tristate")
    const knapp = verdi ? ja : nei
    if (!knapp) return false
    knapp.click()
    return lesKryss(felt) === verdi
  }
  // Av/på: ukjent tilstand røres ikke. «Nei» betyr ikke avkrysset.
  if (naa === null) return false
  if (naa === verdi) return true
  felt.el.click()
  return lesKryss(felt) === verdi
}

/** Alle felt i et dokument, i rekkefølgen de står. Verdier leses ikke her. */
function feltIDokument(form) {
  const felt = []
  for (const pd of form.querySelectorAll("pddata")) {
    const tristate = pd.querySelector(".fielddata .tristate")
    const knapp = pd.querySelector(".fielddata button.b-check")
    const inn = pd.querySelector(".fielddata textarea, .fielddata input[type='text']")
    const el = tristate ?? knapp ?? inn
    if (!el) continue
    const legend = tekst(pd.querySelector(".legend"))
    const visning = tristate
      ? tekst(tristate.querySelector(".tristate-caption"))
      : knapp
        ? tekst(knapp.querySelector(".chktxt")) || legend
        : legend || (inn.getAttribute("placeholder") ?? "").replace(/\s+/g, " ").trim()
    if (!visning) continue
    const gruppe = pd.closest(".relation-group-box")
    felt.push({
      tekst: visning,
      nokkel: norm(visning),
      slag: tristate ? "tristate" : knapp ? "kryss" : "tekst",
      type: tristate || knapp ? "avkrysning" : inn instanceof HTMLTextAreaElement ? "flerlinje" : "tekst",
      seksjon: gruppe ? tekst(gruppe.querySelector(".tabitem")) : "",
      el,
    })
  }
  return felt
}

function alleDokumenter() {
  const dokumenter = []
  for (const form of document.querySelectorAll('form[id^="docform"]')) {
    if (!synlig(form)) continue
    const felt = feltIDokument(form)
    if (felt.length) dokumenter.push({ form, dokId: form.id, felt })
  }
  return dokumenter
}

/**
 * Kobler ønskede felt (tekst + type) til feltene i dokumentet. Flere felt kan ha samme tekst
 * («Nå» under både 5.3 a og 5.3 b). `nr` sier hvilket av dem det gjelder (0 = første), regnet
 * i skjemadefinisjonen — ikke blant feltene som tilfeldigvis sendes denne gangen. Uten `nr`
 * (eldre LegeAssist) kobles like tekster i rekkefølgen de kommer.
 */
function koble(dok, onskede) {
  const brukt = new Set()
  const par = []
  const mangler = []
  for (const o of onskede) {
    const nokkel = norm(o.tekst)
    const kandidater = []
    dok.felt.forEach((f, idx) => {
      if (f.nokkel === nokkel && (f.type === "avkrysning") === (o.type === "avkrysning")) kandidater.push(idx)
    })
    const i = Number.isInteger(o.nr) ? kandidater[o.nr] : kandidater.find((idx) => !brukt.has(idx))
    if (i === undefined || brukt.has(i)) {
      mangler.push(o.id)
      continue
    }
    brukt.add(i)
    par.push({ onsket: o, felt: dok.felt[i] })
  }
  return { par, mangler }
}

function dokumentHode(form) {
  const p = pasient(form)
  return {
    tittel: tekst(form.querySelector(".document-name > div")) || tekst(form.querySelector(".document-name")) || "Skjema",
    navn: p.navn,
    fodt: p.fodt,
  }
}

function erLaast(el) {
  if (el.classList.contains("tristate")) return !el.querySelector(".tristate-writeable")
  return el.disabled || el.readOnly || el.classList.contains("readonly")
}

/** Åpne dokumenter som har minst ett av feltene skjemaet leter etter. */
function finnSkjema(onskede) {
  const funn = []
  for (const dok of alleDokumenter()) {
    const { par, mangler } = koble(dok, onskede)
    if (par.length === 0) continue
    funn.push({
      dokId: dok.dokId,
      ...dokumentHode(dok.form),
      treff: par.length,
      mangler,
      laast: par.every((p) => erLaast(p.felt.el)),
      harInnhold: par.filter((p) => p.felt.type !== "avkrysning" && p.felt.el.value.trim()).map((p) => p.onsket.id),
    })
  }
  return funn
}

function fyllSkjema(dokId, verdier, modus) {
  const dok = alleDokumenter().find((d) => d.dokId === dokId)
  if (!dok) return { ok: false, grunn: "fant-ikke-felt" }
  const { par, mangler } = koble(dok, verdier)
  if (par.length === 0) return { ok: false, grunn: "fant-ikke-felt" }

  const tekstPar = par.filter((p) => p.felt.type !== "avkrysning" && typeof p.onsket.verdi === "string" && p.onsket.verdi.trim())
  if (modus === "tom") {
    const harInnhold = tekstPar.filter((p) => p.felt.el.value.trim())
    if (harInnhold.length) return { ok: false, grunn: "har-innhold", felt: harInnhold.map((p) => p.onsket.id) }
  }

  const fylt = []
  const urort = [...mangler]

  // Avkrysning og ja/nei først: noen tekstfelt vises først når et ja/nei-felt er besvart.
  for (const p of par.filter((x) => x.felt.type === "avkrysning" && typeof x.onsket.verdi === "boolean")) {
    if (!erLaast(p.felt.el) && settKryss(p.felt, p.onsket.verdi)) fylt.push(p.onsket.id)
    else urort.push(p.onsket.id)
  }

  for (const p of tekstPar) {
    if (erLaast(p.felt.el)) {
      urort.push(p.onsket.id)
      continue
    }
    const ny = p.onsket.verdi.trim()
    const eksisterende = p.felt.el.value.replace(/\s+$/, "")
    const skille = p.felt.type === "flerlinje" ? "\n\n" : " "
    settVerdi(p.felt.el, modus === "legg-til" && eksisterende ? `${eksisterende}${skille}${ny}` : ny)
    fylt.push(p.onsket.id)
  }

  const forste = par.find((p) => fylt.includes(p.onsket.id))
  if (forste && synlig(forste.felt.el)) forste.felt.el.scrollIntoView({ block: "center" })
  return { ok: true, fylt, urort }
}

/** Strukturen i åpne dokumenter (tekst, type, fane) — til import i LegeAssist. Aldri verdier. */
function lesSkjemaStruktur() {
  return alleDokumenter().map((dok) => ({
    dokId: dok.dokId,
    tittel: dokumentHode(dok.form).tittel,
    felter: dok.felt.map((f) => ({ tekst: f.tekst, type: f.type, seksjon: f.seksjon })),
  }))
}

// ─── Meldinger fra bakgrunnsskriptet ─────────────────────────────────────────
// Rammer som ikke har noe å melde, svarer ikke — da kan en annen ramme i fanen svare.

function svarNotat(msg, sendResponse) {
  const funn = finnNotater()
  if (funn.notater.length === 0 && funn.laaste === 0) return false

  if (msg.type === "finn-notater") {
    sendResponse({ notater: funn.notater.map(beskriv), laaste: funn.laaste })
    return true
  }
  const notat = funn.notater.find((n) => n.dokId === msg.dokId)
  sendResponse(notat ? fyll(notat, msg.felter, msg.modus) : { ok: false, grunn: "fant-ikke-felt" })
  return true
}

function svar(msg, sendResponse) {
  switch (msg?.type) {
    case "finn-notater":
    case "fyll-notat":
      return svarNotat(msg, sendResponse)
    case "hent-pasient": {
      const pasienter = lesPasienter()
      if (pasienter.length === 0) return false
      sendResponse({ pasienter })
      return true
    }
    case "finn-skjema": {
      const skjema = finnSkjema(msg.felter)
      if (skjema.length === 0) return false
      sendResponse({ skjema })
      return true
    }
    case "les-skjema": {
      const dokumenter = lesSkjemaStruktur()
      if (dokumenter.length === 0) return false
      sendResponse({ dokumenter })
      return true
    }
    case "fyll-skjema": {
      if (!alleDokumenter().some((d) => d.dokId === msg.dokId)) return false
      sendResponse(fyllSkjema(msg.dokId, msg.verdier, msg.modus))
      return true
    }
    default:
      return false
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    svar(msg, sendResponse)
  } catch (err) {
    sendResponse({ ok: false, grunn: "feil", melding: String(err?.message ?? err) })
  }
  return false
})
