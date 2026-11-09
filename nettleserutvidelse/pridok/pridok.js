// Innholdsskript i Pridok (epj3.pridok.no). Finner åpne notater ut fra feltetikettene,
// beskriver dem (dokumenttype, pasientnavn, fødselsdato, om feltene har tekst) og fyller
// det notatet legen velger. Gul lapp røres aldri. Notatet låses aldri
// herfra — Pridok autolagrer, og legen ser over teksten.
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
    const form = ta.closest("form")
    const dokId = form?.id || "dokument"
    if (!dokumenter.has(dokId)) {
      dokumenter.set(dokId, { form, felt: { anamnese: [], funn: [], vurdering: [], tiltak: [] } })
    }
    dokumenter.get(dokId).felt[felt].push(ta)
  }

  const notater = []
  let laaste = 0
  for (const [dokId, { form, felt }] of dokumenter) {
    if (ALLE.some((k) => felt[k].length === 0)) continue
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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "finn-notater" && msg?.type !== "fyll-notat") return false

  let funn
  try {
    funn = finnNotater()
  } catch (err) {
    sendResponse({ ok: false, grunn: "feil", melding: String(err?.message ?? err) })
    return false
  }
  // Rammer uten notater svarer ikke, så en annen ramme i samme fane kan svare.
  if (funn.notater.length === 0 && funn.laaste === 0) return false

  if (msg.type === "finn-notater") {
    sendResponse({ notater: funn.notater.map(beskriv), laaste: funn.laaste })
    return false
  }

  const notat = funn.notater.find((n) => n.dokId === msg.dokId)
  if (!notat) {
    sendResponse({ ok: false, grunn: "fant-ikke-felt" })
    return false
  }
  try {
    sendResponse(fyll(notat, msg.felter, msg.modus))
  } catch (err) {
    sendResponse({ ok: false, grunn: "feil", melding: String(err?.message ?? err) })
  }
  return false
})
