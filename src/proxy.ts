import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { OKT_COOKIE, OKT_COOKIE_FRIST_MS } from "@/lib/okt"

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/utlogget") ||
    pathname.startsWith("/tilgang") ||
    pathname.startsWith("/sett-passord") ||
    pathname.startsWith("/glemt-passord") ||
    pathname.startsWith("/databehandleravtale") ||
    pathname.startsWith("/api/auth")

  if (isPublicRoute) return NextResponse.next()

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Lukket nettleser = utlogget. Øktcookien har ingen utløpsdato og forsvinner
  // når nettleseren lukkes; innloggingscookien fra Auth.js har alltid en.
  const { oktId, innlogget } = req.auth
  if (oktId && req.cookies.get(OKT_COOKIE)?.value !== oktId) {
    if (innlogget && Date.now() - innlogget < OKT_COOKIE_FRIST_MS) {
      // Første forespørsel etter innlogging: sett øktcookien
      const res = NextResponse.next()
      res.cookies.set(OKT_COOKIE, oktId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      })
      return res
    }
    // Siden logger ut via Auth.js (sletter innloggingscookien) og sender til /login
    return NextResponse.redirect(new URL("/utlogget?grunn=lukket", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
