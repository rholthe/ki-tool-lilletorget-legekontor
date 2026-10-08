import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
    /** Tilfeldig id for denne innloggingen — speiles i øktcookien `la_okt`. */
    oktId?: string
    /** Innloggingstidspunkt (ms). */
    innlogget?: number
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    oktId?: string
    innlogget?: number
    sistAktiv?: number
  }
}
