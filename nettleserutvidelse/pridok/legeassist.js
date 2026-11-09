// Innholdsskript på LegeAssist-siden. Kunngjør at utvidelsen finnes, og videresender
// «Send til journal» fra siden til bakgrunnsskriptet. Kun samme opprinnelse godtas.

const FRA_SIDEN = "legeassist"
const FRA_UTVIDELSEN = "legeassist-utvidelse"
const VERSJON = chrome.runtime.getManifest().version

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

  if (d.type === "send-til-journal" && typeof d.id === "string") {
    let svar
    try {
      svar = await chrome.runtime.sendMessage({
        type: "send-til-journal",
        felter: d.felter,
        modus: d.modus,
      })
    } catch (err) {
      svar = { ok: false, grunn: "feil", melding: String(err?.message ?? err) }
    }
    post({ type: "svar", id: d.id, svar })
  }
})

post({ type: "klar", versjon: VERSJON })
