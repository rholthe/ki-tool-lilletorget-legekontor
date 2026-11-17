// Oppretter første bruker (typisk administrator) og skriver ut en engangslenke for å sette passord.
// Trengs fordi selvregistrering er av, og /admin/brukere bare kan brukes av en innlogget admin.
// Virker uten SMTP: lenken skrives til terminalen i stedet for å sendes på e-post.
//
// Bruk (i containeren, der .env allerede er lastet):
//   docker exec -it legeassist node scripts/opprett-admin.mjs <e-post> "<Navn>"
// eller lokalt med DATABASE_URL i .env:
//   node scripts/opprett-admin.mjs <e-post> "<Navn>"
//
// E-posten må også stå i ADMIN_EMAILS for at brukeren skal bli administrator.
// Finnes brukeren fra før, lages bare en ny lenke (gyldig 7 dager).
import "dotenv/config"
import { createHash, randomBytes } from "node:crypto"

const [email, navn] = process.argv.slice(2)
if (!email || !email.includes("@")) throw new Error('Bruk: node scripts/opprett-admin.mjs <e-post> "<Navn>"')
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL mangler")

const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim())
if (!admins.includes(email)) console.warn(`Advarsel: ${email} står ikke i ADMIN_EMAILS, så brukeren blir ikke administrator.`)

const nyId = () => "c" + BigInt("0x" + randomBytes(16).toString("hex")).toString(36).padStart(24, "0").slice(0, 24)

const { default: mariadb } = await import("mariadb")
const u = new URL(process.env.DATABASE_URL)
const c = await mariadb.createConnection({ host: u.hostname, port: +u.port || 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1) })
try {
  let [bruker] = await c.query("select id from User where email = ?", [email])
  if (!bruker) {
    bruker = { id: nyId() }
    await c.query("insert into User (id,name,email,twoFactorEnabled,createdAt,updatedAt) values (?,?,?,0,utc_timestamp(3),utc_timestamp(3))", [bruker.id, navn ?? null, email])
    console.log(`Opprettet bruker ${email}.`)
  } else {
    console.log(`Brukeren ${email} finnes fra før; lager ny lenke.`)
  }
  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  await c.query("delete from PasswordSetupToken where userId = ?", [bruker.id])
  await c.query("insert into PasswordSetupToken (id,tokenHash,userId,expires,createdAt) values (?,?,?,date_add(utc_timestamp(3), interval 7 day),utc_timestamp(3))", [nyId(), tokenHash, bruker.id])
  const basis = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
  console.log(`\nÅpne denne lenken for å sette passord (gyldig 7 dager, kan brukes én gang):\n${basis}/sett-passord?token=${token}\n`)
} finally {
  await c.end()
}
