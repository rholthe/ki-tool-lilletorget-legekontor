import TurndownService from "turndown"

/**
 * Tekst fra Helsedirektoratets API: HTML-entiteter i korte felt, og HTML i
 * brødtekst som gjøres om til Markdown. Ren modul — brukes av serveren og
 * skriptene, aldri i nettleseren.
 */

const ENTITETER: Record<string, string> = {
  "&gt;": ">",
  "&lt;": "<",
  "&amp;": "&",
  "&nbsp;": " ",
  "&quot;": '"',
  "&#39;": "'",
}

/** Kildens etiketter og visningstekster er HTML-escapet. */
export function avkod(tekst: string): string {
  return tekst
    .replace(/&(gt|lt|amp|nbsp|quot|#39);/g, (m) => ENTITETER[m] ?? m)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  emDelimiter: "*",
})
turndown.remove(["script", "style", "iframe", "object", "embed", "form"])

/**
 * HTML → Markdown. Resultatet rendres med react-markdown uten rå HTML, så selv
 * en ufullkommen konvertering kan ikke bli en sårbarhet — verste utfall er
 * formatering som ser litt rar ut.
 */
export function tilMarkdown(html: string | null | undefined): string {
  if (!html?.trim()) return ""
  return turndown
    .turndown(html.replace(/&nbsp;/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
