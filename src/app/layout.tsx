import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { auth } from "@/lib/auth"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

export const metadata: Metadata = {
  title: "legeassist",
  description: "KI-assistent for fastleger",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="no" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <SessionProvider session={session}>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
