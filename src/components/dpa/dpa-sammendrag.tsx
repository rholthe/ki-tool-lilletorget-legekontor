import { ExternalLink } from "lucide-react"

/**
 * Kort beskrivelse av hva databehandleravtalen regulerer, med lenke til den
 * fullstendige siden (åpnes i ny fane). Brukes i passordoppsett og i
 * signeringsgaten for innloggede brukere.
 */
export function DpaSammendrag() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 space-y-2">
      <p>
        Som lege er du <strong>behandlingsansvarlig</strong> for
        pasientopplysningene. legeassist er <strong>databehandler</strong> og
        behandler opplysninger kun på dine instrukser. Avtalen regulerer hva som
        behandles, hvordan det sikres, hvilke EU-underleverandører som brukes
        (Soniox, AWS), og pasientenes rettigheter etter GDPR og Normen for
        informasjonssikkerhet.
      </p>
      <a
        href="/databehandleravtale"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
      >
        Les hele databehandleravtalen og sikkerhetsinformasjonen
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}
