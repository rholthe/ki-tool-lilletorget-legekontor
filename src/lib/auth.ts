import NextAuth, { CredentialsSignin } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import speakeasy from "speakeasy"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import { fornyOktToken } from "@/lib/okt"

// Eget feilsignal for 2FA-krav — fanges av login-siden
export class TwoFactorRequired extends CredentialsSignin {
  code = "TwoFactorRequired"
}

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

        // 2FA-sjekk
        if (user.twoFactorEnabled) {
          if (!totp) throw new TwoFactorRequired()
          if (!user.twoFactorSecret) return null
          const secret = decrypt(user.twoFactorSecret)
          const totpOk = speakeasy.totp.verify({
            secret,
            encoding: "base32",
            token: totp,
            window: 1,
          })
          if (!totpOk) return null
        }

        return { id: user.id, email: user.email, name: user.name }
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
