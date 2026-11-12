// Arbeidstilsynet AT-474 «Tilrettelegging/omplassering ved graviditet» (september 2026). Lagt inn 12.11.2026.
// Databasen er fasiten etter at admin har rettet i skjemaet på /admin/skjema.
// - Bare PDF, ikke Pridok. Legen fyller del 1 (side 1); del 2 (arbeidsgiver) og veiledningen følger med urørt
// - Originalen er låst for endring, men tillater utfylling. Malen i databasen er en ulåst kopi (pikepdf),
//   fordi pdf-lib ikke kan skrive i krypterte filer
// - Telefonnummer har ingen kilde (legeprofilen har bare navn og HPR) og fylles av legen
// - «Underskrift» er bevisst ikke koblet
const D = "Del 1: Melding om behov for tilrettelegging/omplassering"
export const kategori = "NAV"
export const navn = "Tilrettelegging/omplassering ved graviditet (svangerskapspenger)"
export const beskrivelse = "Arbeidstilsynets skjema AT-474. Del 1 fylles ut av lege eller jordmor og er grunnlag for søknad om svangerskapspenger"
export const prompt = `Dette er del 1 av Arbeidstilsynets skjema for tilrettelegging eller omplassering ved graviditet. Legen beskriver hvilke forhold i arbeidet som kan gi risiko for forplantningsskader, og hvilken tilrettelegging eller omplassering som er nødvendig. Den gravide tar skjemaet med til arbeidsgiveren, som i del 2 svarer på om det lar seg gjennomføre. Kan det ikke gjennomføres, brukes skjemaet som dokumentasjon når hun søker Nav om svangerskapspenger.

Leseren er arbeidsgiveren, og deretter Nav. Det skal derfor ikke stå diagnoser eller andre medisinske opplysninger om den gravide i skjemaet. Vurderingen skal ta utgangspunkt i forholdene på arbeidsplassen, ikke i kvinnens helse eller i at svangerskapet er risikofylt. Utelat alt som gjelder sykdom, plager, funn og behandling, også når det står i konteksten. Er det den gravides egen helse og ikke arbeidsforholdene som gjør at hun ikke kan arbeide, hører det hjemme i en sykmelding og ikke her — la da 1.2 og 1.3 stå tomme.

Risikoforhold kan være arbeidstid (natt, skift, lange vakter), arbeidsmengde, kjemisk eller biologisk påvirkning (løsemidler, cytostatika, anestesigasser, smitte), stråling, støy, vibrasjon, tunge løft, belastende arbeidsstillinger, langvarig ståing og gåing, vold og trusler, eller manglende mulighet for hvile og pauser. Beskriv bare forhold som faktisk framgår av opplysningene om denne arbeidsplassen.

Beskrivelsen av tilretteleggingen må være konkret nok til at arbeidsgiveren kan vurdere om den lar seg gjennomføre: hva som må unngås eller endres, og hvilket arbeid hun fortsatt kan gjøre. Skriv i et nøkternt og lett forståelig språk uten faguttrykk, i sammenhengende tekst uten punktlister.

Skjemaet gjelder én arbeidsgiver. Har den gravide flere arbeidsgivere, fylles det ut ett skjema for hver.`
export const felter = [
  { id: "f1", etikett: "Den gravides navn", type: "tekst", kilde: "pasient.navn", seksjon: D, pdf: { felt: "Text2" }, maksTegn: 65 },
  { id: "f2", etikett: "Fødselsnummer (11 siffer)", type: "tekst", kilde: "pasient.fnr", seksjon: D, pdf: { felt: "TextFnr" }, maksTegn: 18 },
  { id: "f3", etikett: "Termindato", type: "tekst", kilde: "ai", seksjon: D,
    instruks: "Termindatoen som dd.mm.åååå, bare når den framgår av opplysningene. Regn den ikke ut selv fra siste menstruasjon eller svangerskapsuke. Ellers tomt.",
    pdf: { felt: "TextTermin" }, maksTegn: 15 },
  { id: "f4", etikett: "Gateadresse", type: "tekst", kilde: "pasient.adresse", seksjon: D, pdf: { felt: "Text3" }, maksTegn: 52 },
  { id: "f5", etikett: "Postnummer", type: "tekst", kilde: "pasient.postnr", seksjon: D, pdf: { felt: "Textpnr" }, maksTegn: 10 },
  { id: "f6", etikett: "Poststed", type: "tekst", kilde: "pasient.poststed", seksjon: D, pdf: { felt: "Textpsted" }, maksTegn: 37 },
  { id: "f7", etikett: "Arbeidsgivers navn og adresse", type: "flerlinje", kilde: "ai", seksjon: D,
    instruks: "Arbeidsgiverens navn, og adressen når den framgår. Bare det som står i opplysningene; ellers tomt.",
    pdf: { felt: "Text4" }, maksTegn: 160 },
  { id: "f8", etikett: "Den gravides stillingsprosent", type: "tekst", kilde: "ai", seksjon: D,
    instruks: "Stillingsprosenten hos denne arbeidsgiveren som et tall uten prosenttegn, f.eks. «100» eller «80» (prosenttegnet står i skjemaet). Tomt når den ikke framgår.",
    pdf: { felt: "Text5" }, maksTegn: 4 },
  { id: "f9", etikett: "1.1 Tilrettelegging/omplassering er nødvendig fra og med (dato)", type: "tekst", kilde: "ai", seksjon: D,
    instruks: "Datoen tilretteleggingen eller omplasseringen må gjelde fra, som dd.mm.åååå. Bruk datoen som framgår av opplysningene. Tomt når ingen dato er nevnt.",
    pdf: { felt: "TextDato" }, maksTegn: 15 },
  { id: "f10", etikett: "1.2 Påvirkninger i arbeidsmiljøet som kan gi risiko for forplantningsskader", type: "flerlinje", kilde: "ai", seksjon: D,
    instruks: "Beskriv hva arbeidet går ut på, og hvilke konkrete forhold ved det som kan gi risiko for forplantningsskader, f.eks. nattarbeid, tunge løft, kjemisk eller biologisk påvirkning, langvarig ståing eller manglende pauser. Bare forhold på arbeidsplassen. Ingen diagnoser, plager eller andre medisinske opplysninger om den gravide. Tre til seks setninger.",
    pdf: { felt: "Text8" }, maksTegn: 1210 },
  { id: "f11", etikett: "1.3 Hvilken tilrettelegging/omplassering som er nødvendig", type: "flerlinje", kilde: "ai", seksjon: D,
    instruks: "Beskriv konkret hva som må unngås eller endres for hvert risikoforhold i 1.2, og hvilket arbeid den gravide fortsatt kan gjøre. Utfyllende nok til at arbeidsgiveren kan vurdere om det lar seg gjennomføre. Ingen medisinske opplysninger. Tre til seks setninger.",
    pdf: { felt: "Text11" }, maksTegn: 1620 },
  { id: "f12", etikett: "Legens telefonnummer", type: "tekst", kilde: "manuell", seksjon: "Lege eller jordmor", pdf: { felt: "Text15S1Dato" }, maksTegn: 130 },
  { id: "f13", etikett: "Lege eller jordmors navn", type: "tekst", kilde: "lege.navn", seksjon: "Lege eller jordmor", pdf: { felt: "TextLegeNavnAdr" }, maksTegn: 530 },
  { id: "f14", etikett: "Dato", type: "tekst", kilde: "dato.idag", seksjon: "Lege eller jordmor", pdf: { felt: "Text16" }, maksTegn: 57 },
]
