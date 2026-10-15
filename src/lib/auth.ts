import NextAuth, { CredentialsSignin } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import speakeasy from "speakeasy"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import { fornyOktToken } from "@/lib/okt"
import { antallUbrukte, brukKode, erGjenopprettingskode } from "@/lib/gjenoppretting"
import { varsleBruktGjenopprettingskode } from "@/lib/to-faktor-varsel"
import { verifiserInnlogging } from "@/lib/passkey"

// Eget feilsignal for 2FA-krav — fanges av login-siden
export class TwoFactorRequired extends CredentialsSignin {
  code = "TwoFactorRequired"
}

const passkeySchema = z.object({
  utfordringId: z.string().min(1).max(64),
  svar: z.string().min(1).max(20_000),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        totp: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password, totp } = parsed.data

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.passwordHash) return null

        const passwordOk = await bcrypt.compare(password, user.passwordHash)
        if (!passwordOk) return null

        // 2FA-sjekk: koden fra appen, eller en gjenopprettingskode (engangs)
        if (user.twoFactorEnabled) {
          if (!totp) throw new TwoFactorRequired()
          if (!user.twoFactorSecret) return null
          const kode = totp.trim()
          const totpOk =
            /^\d{6}$/.test(kode) &&
            speakeasy.totp.verify({
              secret: decrypt(user.twoFactorSecret),
              encoding: "base32",
              token: kode,
              window: 1,
            })
          if (!totpOk) {
            if (!erGjenopprettingskode(kode) || !(await brukKode(user.id, kode))) return null
            // Varsle brukeren, uten å holde igjen innloggingen
            void antallUbrukte(user.id).then((igjen) => varsleBruktGjenopprettingskode(user, igjen))
          }
        }

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
    // Passkey erstatter både passord og engangskode: brukerverifisering
    // (biometri/PIN) kreves, så den er tofaktor i seg selv. Se src/lib/passkey.ts.
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: {
        utfordringId: {},
        svar: {},
      },
      async authorize(credentials) {
        const parsed = passkeySchema.safeParse(credentials)
        if (!parsed.success) return null
        let svar
        try {
          svar = JSON.parse(parsed.data.svar)
        } catch {
          return null
        }
        if (typeof svar?.id !== "string") return null
        return verifiserInnlogging(parsed.data.utfordringId, svar)
      },
    }),
  ],
  callbacks: {
    // Kjøres ved hver forespørsel gjennom proxyen, så sistAktiv følger brukerens
    // faktiske bruk. Returnerer null (= utlogget) ved inaktivitet eller når
    // dagens økt er brukt opp. Se src/lib/okt.ts.
    async jwt({ token, user }) {
      return fornyOktToken(token, user?.id, Date.now(), () => crypto.randomUUID())
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.oktId = token.oktId
      session.innlogget = token.innlogget
      return session
    },
  },
})
