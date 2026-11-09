// Bakgrunnsskript: tar imot notatet fra LegeAssist-fanen, finner en åpen Pridok-fane
// og ber innholdsskriptet der fylle feltene. Ingenting lagres og ingenting sendes ut
// av nettleseren.

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

const FELT = ["anamnese", "funn", "vurdering", "tiltak"]
const MODUS = ["tom", "legg-til", "erstatt"]

function gyldig(msg) {
  if (!msg || typeof msg.felter !== "object" || !MODUS.includes(msg.modus)) return false
  return FELT.every((f) => typeof msg.felter[f] === "string")
}

async function send(msg) {
  const faner = await chrome.tabs.query({ url: PRIDOK })
  if (faner.length === 0) return { ok: false, grunn: "ingen-fane" }

  // Sist brukte Pridok-fane først
  faner.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))

  let sisteSvar = null
  for (const fane of faner) {
    let svar
    try {
      svar = await chrome.tabs.sendMessage(fane.id, {
        type: "fyll-journal",
        felter: msg.felter,
        modus: msg.modus,
      })
    } catch {
      svar = null // ingen ramme i fanen har notatfeltene
    }
    if (!svar) continue
    if (svar.ok) {
      await chrome.tabs.update(fane.id, { active: true })
      if (fane.windowId !== undefined) {
        await chrome.windows.update(fane.windowId, { focused: true }).catch(() => {})
      }
      return svar
    }
    if (svar.grunn !== "fant-ikke-felt") return svar
    sisteSvar = svar
  }
  return sisteSvar ?? { ok: false, grunn: "fant-ikke-felt" }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "send-til-journal") return false
  if (!sender.url || !erLegeassist(sender.url)) return false
  if (!gyldig(msg)) {
    sendResponse({ ok: false, grunn: "feil", melding: "Ugyldig forespørsel." })
    return false
  }
  send(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, grunn: "feil", melding: String(err?.message ?? err) }))
  return true
})
