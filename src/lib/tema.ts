import type { ComponentType } from "react"
import { Stethoscope, Users, Mic, BookOpen, Sparkles, FileText } from "lucide-react"
import type { KonsultasjonsType } from "@/types/konsultasjon"

/**
 * Fargetema per konsultasjonstype. Brukes for å gi hovedvisningen og
 * sidebar-kortene en gjennomgående farge som matcher oppgaveknappen.
 *
 * Alle verdier er komplette Tailwind-klasser (inkl. hover:-varianter) slik at
 * de plukkes opp av Tailwind sin innholdsskanning — ikke bygg klassenavn dynamisk.
 */
export interface TypeTema {
  /** Primær, fylt handlingsknapp (f.eks. «Start opptak»). */
  knapp: string
  /** Outline-knapp med aksentfarge (f.eks. «Fortsett»). */
  utlinje: string
  /** Badge i toppraden. */
  badge: string
  /** Aksentfarget tekst (f.eks. «Claude skriver…»). */
  tekst: string
  /** Ikonfarge (sidebar-kort, header). */
  ikon: string
  /** Lys bakgrunn for ikon-«chip». */
  ikonBg: string
  /** Markering av aktivt sidebar-kort. */
  aktivKort: string
}

const BLAA: TypeTema = {
  knapp: "bg-blue-600 hover:bg-blue-700 text-white",
  utlinje: "border-blue-300 text-blue-700 hover:bg-blue-50",
  badge: "bg-blue-100 text-blue-700 border-blue-200",
  tekst: "text-blue-600",
  ikon: "text-blue-500",
  ikonBg: "bg-blue-100",
  aktivKort: "bg-blue-50 border-blue-200",
}

const GRONN: TypeTema = {
  knapp: "bg-emerald-600 hover:bg-emerald-700 text-white",
  utlinje: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
  badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  tekst: "text-emerald-600",
  ikon: "text-emerald-500",
  ikonBg: "bg-emerald-100",
  aktivKort: "bg-emerald-50 border-emerald-200",
}

const AMBER: TypeTema = {
  knapp: "bg-amber-600 hover:bg-amber-700 text-white",
  utlinje: "border-amber-300 text-amber-700 hover:bg-amber-50",
  badge: "bg-amber-100 text-amber-700 border-amber-200",
  tekst: "text-amber-600",
  ikon: "text-amber-500",
  ikonBg: "bg-amber-100",
  aktivKort: "bg-amber-50 border-amber-200",
}

const LILLA: TypeTema = {
  knapp: "bg-violet-600 hover:bg-violet-700 text-white",
  utlinje: "border-violet-300 text-violet-700 hover:bg-violet-50",
  badge: "bg-violet-100 text-violet-700 border-violet-200",
  tekst: "text-violet-600",
  ikon: "text-violet-500",
  ikonBg: "bg-violet-100",
  aktivKort: "bg-violet-50 border-violet-200",
}

const TEAL: TypeTema = {
  knapp: "bg-teal-600 hover:bg-teal-700 text-white",
  utlinje: "border-teal-300 text-teal-700 hover:bg-teal-50",
  badge: "bg-teal-100 text-teal-700 border-teal-200",
  tekst: "text-teal-600",
  ikon: "text-teal-500",
  ikonBg: "bg-teal-100",
  aktivKort: "bg-teal-50 border-teal-200",
}

const ROSA: TypeTema = {
  knapp: "bg-rose-600 hover:bg-rose-700 text-white",
  utlinje: "border-rose-300 text-rose-700 hover:bg-rose-50",
  badge: "bg-rose-100 text-rose-700 border-rose-200",
  tekst: "text-rose-600",
  ikon: "text-rose-500",
  ikonBg: "bg-rose-100",
  aktivKort: "bg-rose-50 border-rose-200",
}

export const TYPE_TEMA: Record<KonsultasjonsType, TypeTema> = {
  KONSULTASJON: BLAA,
  TELEFONKONSULTASJON: BLAA,
  MOTE: GRONN,
  DIKTAT: AMBER,
  JOURNALGJENNOMGANG: LILLA,
  AIHJELP: TEAL,
  SKJEMA: ROSA,
}

/**
 * Ikon per type — samme ikon som oppgaveknappen i sidebar, uavhengig av form
 * (telefon/video/fysisk gir samme ikon).
 */
export const TYPE_IKON_KOMP: Record<
  KonsultasjonsType,
  ComponentType<{ className?: string }>
> = {
  KONSULTASJON: Stethoscope,
  TELEFONKONSULTASJON: Stethoscope,
  MOTE: Users,
  DIKTAT: Mic,
  JOURNALGJENNOMGANG: BookOpen,
  AIHJELP: Sparkles,
  SKJEMA: FileText,
}
