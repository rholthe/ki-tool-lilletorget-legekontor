// Bakgrunnsskript: finner åpne notater og skjema i alle Pridok-faner, fyller det
// dokumentet legen velger i LegeAssist, og leser personalia for pasienten som er åpen.
// Ingenting lagres og ingenting sendes ut av nettleseren.

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

// ─── Pasient og skjema ───────────────────────────────────────────────────────

const FELTTYPER = ["tekst", "flerlinje", "avkrysning"]

function gyldigeFelter(felter, medVerdi) {
  if (!Array.isArray(felter) || felter.length === 0 || felter.length > 300) return false
  return felter.every(
    (f) =>
      f &&
      typeof f.id === "string" &&
      typeof f.tekst === "string" &&
      f.tekst.length <= 500 &&
      FELTTYPER.includes(f.type) &&
      (f.nr === undefined || (Number.isInteger(f.nr) && f.nr >= 0 && f.nr < 300)) &&
      (!medVerdi || typeof f.verdi === "string" || typeof f.verdi === "boolean"),
  )
}

function gyldigFyllSkjema(msg) {
  return (
    Number.isInteger(msg?.tabId) &&
    typeof msg.dokId === "string" &&
    MODUS.includes(msg.modus) &&
    gyldigeFelter(msg.verdier, true)
  )
}

/** Spør alle Pridok-faner (sist brukte først) og samler det `plukk` finner i svarene. */
async function sporAlleFaner(melding, plukk) {
  const faner = await chrome.tabs.query({ url: PRIDOK })
  faner.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
  const funn = []
  for (const [i, fane] of faner.entries()) {
    let svar = null
    try {
      svar = await chrome.tabs.sendMessage(fane.id, melding)
    } catch {
      // Fanen har ikke noe å melde (eller laster fortsatt)
    }
    const liste = svar ? plukk(svar) : null
    if (!Array.isArray(liste)) continue
    for (const x of liste) funn.push({ ...x, tabId: fane.id, fane: i + 1 })
  }
  return { antallFaner: faner.length, funn }
}

/** Pasienter som er åpne i Pridok. Leses på forespørsel og lagres ikke. */
async function hentPasient() {
  const { antallFaner, funn } = await sporAlleFaner({ type: "hent-pasient" }, (s) => s.pasienter)
  return { ok: true, antallFaner, pasienter: funn }
}

async function finnSkjema(msg) {
  const { antallFaner, funn } = await sporAlleFaner({ type: "finn-skjema", felter: msg.felter }, (s) => s.skjema)
  return { ok: true, antallFaner, skjema: funn }
}

/** Feltene i åpne dokumenter (tekst og type, aldri verdier) — for import av nye skjema. */
async function lesSkjema() {
  const { antallFaner, funn } = await sporAlleFaner({ type: "les-skjema" }, (s) => s.dokumenter)
  return { ok: true, antallFaner, dokumenter: funn }
}

async function fyllSkjema(msg) {
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
      type: "fyll-skjema",
      dokId: msg.dokId,
      verdier: msg.verdier,
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

/** Forespørsel → arbeid, eller null når forespørselen er ugyldig. */
function arbeidFor(msg) {
  switch (msg.type) {
    case "finn-notater":
      return finnNotater()
    case "fyll-notat":
      return gyldigFyll(msg) ? fyllNotat(msg) : null
    case "hent-pasient":
      return hentPasient()
    case "les-skjema":
      return lesSkjema()
    case "finn-skjema":
      return gyldigeFelter(msg.felter, false) ? finnSkjema(msg) : null
    case "fyll-skjema":
      return gyldigFyllSkjema(msg) ? fyllSkjema(msg) : null
    default:
      return undefined
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (typeof msg?.type !== "string") return false
  if (!sender.url || !erLegeassist(sender.url)) return false

  const arbeid = arbeidFor(msg)
  if (arbeid === undefined) return false
  if (arbeid === null) {
    sendResponse({ ok: false, grunn: "feil", melding: "Ugyldig forespørsel." })
    return false
  }
  arbeid
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, grunn: "feil", melding: String(err?.message ?? err) }))
  return true
})
