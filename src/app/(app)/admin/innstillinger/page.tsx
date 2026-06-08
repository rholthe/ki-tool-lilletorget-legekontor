import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isAdmin, hentSystemSetting, tilgjengeligeModeller, tilgjengeligeRegioner, standardModell, standardRegion } from "@/lib/admin"
import { BedrockInnstillinger } from "@/components/admin/bedrock-innstillinger"
import { Separator } from "@/components/ui/separator"
import { Shield, Cpu, Key } from "lucide-react"

export default async function AdminInnstillingerSide() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect("/innstillinger")
  }

  const availableModels = tilgjengeligeModeller()
  const availableRegions = tilgjengeligeRegioner()
  const model = await hentSystemSetting("bedrock_model", standardModell())
  const region = await hentSystemSetting("bedrock_region", standardRegion())

  const harNokler =
    !!process.env.BEDROCK_API_KEY && !!process.env.BEDROCK_SECRET_KEY

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-slate-800">
            Administratorinnstillinger
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Konfigurer AI-modell, region og tilkobling for hele systemet.
        </p>
      </div>

      <Separator />

      {/* API-nøkler status */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            AWS Bedrock-nøkler
          </h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">
              Access Key ID (BEDROCK_API_KEY)
            </span>
            {harNokler ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Konfigurert
              </span>
            ) : (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                Mangler
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Nøklene leses fra <code>.env</code> på serveren. Endre dem ved å oppdatere{" "}
            <code>.env</code> og starte serveren på nytt.
          </p>
        </div>
      </section>

      <Separator />

      {/* Modell og region */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Modell og region
          </h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <BedrockInnstillinger
            model={model}
            region={region}
            availableModels={availableModels}
            availableRegions={availableRegions}
          />
        </div>
        <p className="text-xs text-slate-400">
          Modeller med <code>eu.</code>-prefiks bruker cross-region inference og
          holder data innenfor EU. Aktiver modellene i{" "}
          <strong>AWS Console → Bedrock → Model access</strong>.
        </p>
      </section>
    </div>
  )
}
