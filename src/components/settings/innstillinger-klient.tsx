"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { User, Shield, Key, BookOpen } from "lucide-react"
import { ToFaktorSeksjon } from "@/components/settings/to-faktor-seksjon"
import { PromptbibliotekKlient } from "@/components/settings/promptbibliotek-klient"

interface Props {
  bruker: { name: string | null; email: string | null; twoFactorEnabled: boolean } | null
  aktivModell: string
  aktivRegion: string
  harBedrockNokler: boolean
}

export function InnstillingerKlient({ bruker, aktivModell, aktivRegion, harBedrockNokler }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const aktivFane = searchParams.get("tab") === "prompts" ? "prompts" : "konto"

  function byttFane(verdi: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", verdi)
    router.push(`/innstillinger?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Innstillinger</h1>
        <p className="text-sm text-slate-500 mt-1">Administrer konto, sikkerhet og promptbibliotek.</p>
      </div>

      <Tabs value={aktivFane} onValueChange={byttFane}>
        <TabsList className="mb-6">
          <TabsTrigger value="konto">Konto</TabsTrigger>
          <TabsTrigger value="prompts">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            Promptbibliotek
          </TabsTrigger>
        </TabsList>

        {/* ── Konto-fane ── */}
        <TabsContent value="konto" className="space-y-8 mt-0">

          {/* Profil */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Profil</h2>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Navn</p>
                  <p className="text-slate-700">{bruker?.name ?? "–"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">E-post</p>
                  <p className="text-slate-700">{bruker?.email ?? "–"}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Endring av navn og passord kommer i en fremtidig oppdatering.</p>
            </div>
          </section>

          <Separator />

          {/* Sikkerhet / 2FA */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Sikkerhet</h2>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <ToFaktorSeksjon er2FAaktivert={bruker?.twoFactorEnabled ?? false} />
            </div>
          </section>

          <Separator />

          {/* API-nøkler */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">API-nøkler</h2>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Soniox</p>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Konfigurert på server
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Soniox-nøkkelen er lagret på serveren. Kun kortlivede tokens sendes til nettleseren for opptak.
                  Pasientdata berører aldri serveren.
                </p>
              </div>

              <Separator />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Claude via AWS Bedrock</p>
                  {harBedrockNokler ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Konfigurert
                    </span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      Mangler nøkler
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <p>Modell: <code className="bg-slate-100 px-1 rounded">{aktivModell}</code></p>
                  <p>Region: <code className="bg-slate-100 px-1 rounded">{aktivRegion}</code> — data forlater ikke EU.</p>
                  <p>AWS Bedrock bruker ikke kundedata til modelltrening. Data lagres ikke på vår server — den er en stateless proxy til Bedrock.</p>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* ── Promptbibliotek-fane ── */}
        <TabsContent value="prompts" className="mt-0">
          <PromptbibliotekKlient />
        </TabsContent>
      </Tabs>
    </div>
  )
}
