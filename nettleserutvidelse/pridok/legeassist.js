// Innholdsskript på LegeAssist-siden. Kunngjør at utvidelsen finnes, og videresender
// forespørsler fra siden til bakgrunnsskriptet. Kun samme opprinnelse godtas.

const FRA_SIDEN = "legeassist"
const FRA_UTVIDELSEN = "legeassist-utvidelse"
const VERSJON = chrome.runtime.getManifest().version
const TILLATT = new Set(["finn-notater", "fyll-notat", "hent-pasient", "finn-skjema", "fyll-skjema", "les-skjema"])

function post(data) {
  window.postMessage({ kilde: FRA_UTVIDELSEN, ...data }, location.origin)
}

window.addEventListener("message", async (e) => {
  if (e.origin !== location.origin) return
  const d = e.data
  if (!d || typeof d !== "object" || d.kilde !== FRA_SIDEN) return

  if (d.type === "ping") {
    post({ type: "klar", versjon: VERSJON })
    return
  }

  if (d.type === "foresporsel" && typeof d.id === "string" && TILLATT.has(d.innhold?.type)) {
    let svar
    try {
      svar = await chrome.runtime.sendMessage(d.innhold)
    } catch (err) {
      svar = { ok: false, grunn: "feil", melding: String(err?.message ?? err) }
    }
    post({ type: "svar", id: d.id, svar })
  }
})

post({ type: "klar", versjon: VERSJON })
