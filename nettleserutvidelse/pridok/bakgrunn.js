// Bakgrunnsskript: finner åpne notater i alle Pridok-faner, og fyller det notatet
// legen velger i LegeAssist. Ingenting lagres og ingenting sendes ut av nettleseren.

const PRIDOK = "https://epj3.pridok.no/*"

function erLegeassist(url) {
  try {
    const u = new URL(url)
    return (
      (u.protocol === "https:" && u.hostname === "ki.lilletorget.org") ||
      (u.protocol === "http:" && u.hostname === "localhost")
    )
  } catch {
    return false
  }
}

function erPridok(url) {
  try {
    const u = new URL(url)
    return u.protocol === "https:" && u.hostname === "epj3.pridok.no"
  } catch {
    return false
  }
}

const FELT = ["anamnese", "funn", "vurdering", "tiltak"]
const MODUS = ["tom", "legg-til", "erstatt"]

function gyldigFyll(msg) {
  if (!Number.isInteger(msg?.tabId) || typeof msg.dokId !== "string") return false
  if (!msg.felter || typeof msg.felter !== "object" || !MODUS.includes(msg.modus)) return false
  return FELT.every((f) => typeof msg.felter[f] === "string")
}

/** Alle åpne notater i alle Pridok-faner, sist brukte fane først. */
async function finnNotater() {
  const faner = await chrome.tabs.query({ url: PRIDOK })
  faner.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))

  const notater = []
  let laaste = 0
  for (const [i, fane] of faner.entries()) {
    let svar = null
    try {
      svar = await chrome.tabs.sendMessage(fane.id, { type: "finn-notater" })
    } catch {
      // Fanen har ingen notater (eller laster fortsatt)
    }
    if (!svar || !Array.isArray(svar.notater)) continue
    laaste += svar.laaste ?? 0
    for (const n of svar.notater) notater.push({ ...n, tabId: fane.id, fane: i + 1 })
  }
  return { ok: true, antallFaner: faner.length, notater, laaste }
}

async function fyllNotat(msg) {
  let fane
  try {
    fane = await chrome.tabs.get(msg.tabId)
  } catch {
    return { ok: false, grunn: "ingen-fane" }
  }
  if (!fane.url || !erPridok(fane.url)) return { ok: false, grunn: "ingen-fane" }

  let svar = null
  try {
    svar = await chrome.tabs.sendMessage(fane.id, {
      type: "fyll-notat",
      dokId: msg.dokId,
      felter: msg.felter,
      modus: msg.modus,
    })
  } catch {
    svar = null
  }
  if (!svar) return { ok: false, grunn: "fant-ikke-felt" }
  if (svar.ok) {
    await chrome.tabs.update(fane.id, { active: true })
    if (fane.windowId !== undefined) {
      await chrome.windows.update(fane.windowId, { focused: true }).catch(() => {})
    }
  }
  return svar
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "finn-notater" && msg?.type !== "fyll-notat") return false
  if (!sender.url || !erLegeassist(sender.url)) return false

  let arbeid
  if (msg.type === "finn-notater") {
    arbeid = finnNotater()
  } else if (gyldigFyll(msg)) {
    arbeid = fyllNotat(msg)
  } else {
    sendResponse({ ok: false, grunn: "feil", melding: "Ugyldig forespørsel." })
    return false
  }
  arbeid
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, grunn: "feil", melding: String(err?.message ?? err) }))
  return true
})
