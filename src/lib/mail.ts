import "server-only"
import nodemailer from "nodemailer"
import { headers } from "next/headers"

/**
 * SMTP-konfig leses fra .env. Beregnet for Google Workspace med app-passord:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_USER=ragnar@lilletorget.org
 *   SMTP_PASSWORD=<app-passord uten mellomrom>
 *   SMTP_FROM="legeassist <ragnar@lilletorget.org>"   (valgfri; faller tilbake til SMTP_USER)
 *   ACCESS_REQUEST_TO=ragnar@lilletorget.org          (valgfri; faller tilbake til SMTP_USER)
 */

let transporter: nodemailer.Transporter | null = null

function hentTransporter(): nodemailer.Transporter {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST ?? "smtp.gmail.com"
  const port = Number(process.env.SMTP_PORT ?? 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!user || !pass) {
    throw new Error("SMTP_USER og SMTP_PASSWORD må være satt i .env for å sende e-post")
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implisitt TLS, 587 = STARTTLS
    auth: { user, pass },
  })
  return transporter
}

export function avsenderAdresse(): string {
  return process.env.SMTP_FROM ?? process.env.SMTP_USER ?? ""
}

export function tilgangsforesporselMottaker(): string {
  return process.env.ACCESS_REQUEST_TO ?? process.env.SMTP_USER ?? ""
}

interface SendEpostArgs {
  til: string
  emne: string
  tekst: string
  html?: string
  svarTil?: string
}

export async function sendEpost({ til, emne, tekst, html, svarTil }: SendEpostArgs): Promise<void> {
  const t = hentTransporter()
  await t.sendMail({
    from: avsenderAdresse(),
    to: til,
    subject: emne,
    text: tekst,
    html,
    replyTo: svarTil,
  })
}

/**
 * Beregner appens basis-URL for absolutte lenker i e-post.
 * APP_URL i .env har forrang; ellers utledes den fra request-headere.
 */
export async function hentBasisUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}
