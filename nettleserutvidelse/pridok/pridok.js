// Innholdsskript i Pridok (epj3.pridok.no). Finner notatfeltene ut fra etikettene
// og fyller dem. Gul lapp røres aldri. Notatet lagres eller låses aldri herfra —
// legen ser over og lagrer selv.
//
// Pridok er AngularJS (ng-model på <textarea>). Det holder ikke å sette .value:
// modellen oppdateres først når et «input»-event fyrer.

const MAAL = {
  anamnese: { etikett: "Anamnese", treff: (t) => /^anamnese\b/i.test(t) },
  funn: { etikett: "Funn", treff: (t) => /^funn$/i.test(t) },
  vurdering: { etikett: "Vurdering", treff: (t) => /^vurdering$/i.test(t) },
  tiltak: { etikett: "Tiltak", treff: (t) => /^tiltak$/i.test(t) },
}

function synlig(el) {
  return el.getClientRects().length > 0
}

/** { anamnese: [textarea…], … } — kun synlige felt som kan redigeres. */
function finnFelt() {
  const funnet = { anamnese: [], funn: [], vurdering: [], tiltak: [] }
  for (const legend of document.querySelectorAll(".legend")) {
    const tekst = (legend.textContent ?? "").trim()
    const felt = Object.keys(MAAL).find((k) => MAAL[k].treff(tekst))
    if (!felt) continue
    const boks = legend.closest("pddata") ?? legend.parentElement
    const ta = boks?.querySelector(".fielddata textarea")
    if (ta && synlig(ta)) funnet[felt].push(ta)
  }
  return funnet
}

function settTekst(ta, tekst) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set
  ta.focus()
  setter.call(ta, tekst)
  ta.dispatchEvent(new Event("input", { bubbles: true }))
  ta.dispatchEvent(new Event("change", { bubbles: true }))
  ta.blur()
}

function fyll(felter, modus) {
  const funnet = finnFelt()
  const alleFelt = Object.keys(MAAL)

  // Rammer uten notatfelt svarer ikke, så en annen ramme i samme fane kan svare.
  if (alleFelt.every((k) => funnet[k].length === 0)) return null

  const mangler = alleFelt.filter((k) => funnet[k].length === 0)
  if (mangler.length) {
    return { ok: false, grunn: "fant-ikke-felt", felt: mangler.map((k) => MAAL[k].etikett) }
  }
  // Låste notater på samme side har skrivebeskyttede felt — de teller ikke.
  const redigerbare = Object.fromEntries(
    alleFelt.map((k) => [k, funnet[k].filter((ta) => !ta.disabled && !ta.readOnly)]),
  )
  if (alleFelt.some((k) => redigerbare[k].length > 1)) {
    return { ok: false, grunn: "flere-notater" }
  }

  const aktuelle = alleFelt.filter((k) => felter[k].trim())

  const laast = aktuelle.filter((k) => redigerbare[k].length === 0)
  if (laast.length) {
    return { ok: false, grunn: "skrivebeskyttet", felt: laast.map((k) => MAAL[k].etikett) }
  }
  const mål = Object.fromEntries(aktuelle.map((k) => [k, redigerbare[k][0]]))

  if (modus === "tom") {
    const harInnhold = aktuelle.filter((k) => mål[k].value.trim())
    if (harInnhold.length) {
      return { ok: false, grunn: "har-innhold", felt: harInnhold.map((k) => MAAL[k].etikett) }
    }
  }

  for (const k of aktuelle) {
    const ta = mål[k]
    const eksisterende = ta.value.replace(/\s+$/, "")
    const ny =
      modus === "legg-til" && eksisterende ? `${eksisterende}\n\n${felter[k].trim()}` : felter[k].trim()
    settTekst(ta, ny)
  }

  if (aktuelle.length) mål[aktuelle[0]].scrollIntoView({ block: "center" })
  return { ok: true, fylt: aktuelle.map((k) => MAAL[k].etikett) }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "fyll-journal") return false
  let svar
  try {
    svar = fyll(msg.felter, msg.modus)
  } catch (err) {
    svar = { ok: false, grunn: "feil", melding: String(err?.message ?? err) }
  }
  if (svar) sendResponse(svar)
  return false
})
