// SPK S031 «Legeerklæring ved søknad om forlenget/forhøyet uførepensjon». Lagt inn 12.11.2026.
// Databasen er fasiten etter at admin har rettet i skjemaet på /admin/skjema.
// - «Fremdeles ikke kan arbeide i tidligere stilling» er avkrysning i PDF-en, men fritekst i Pridok: to felt
// - Fanen «Legefaktura» i Pridok er utelatt (legens egne betalingsopplysninger; honoraret går via Helfo)
// - «Signatur Underskrift lege» er bevisst ikke koblet
const A = "Om uførheten", V = "Vurdering av uførheten", T = "Tilleggsopplysninger"
const krys = (navn) => ({ pdf: { felt: navn, valg: "Ja" }, pdfNei: { felt: navn, valg: "Nei" } })
export const kategori = "Pensjon og forsikring"
export const navn = "SPK - Legeerklæring ved søknad om forlenget/forhøyet uførepensjon"
export const beskrivelse = "SPK-skjema S031 ved søknad om forlenget eller forhøyet uførepensjon"
export const prompt = `Dette er en legeerklæring til støtte for søknad om forlenget eller forhøyet uførepensjon fra Statens pensjonskasse (SPK). Søkeren har uførepensjon fra før, og SPK skal vurdere om den skal fortsette eller økes. Mottakeren har den forrige legeerklæringen. Denne erklæringen skal derfor vise hvordan tilstanden og arbeidsevnen er nå, og hva som har skjedd siden sist.

Legg vekt på endring og status: hva som er bedre, verre eller uendret siden forrige erklæring, hvilken behandling som er gitt i mellomtiden og effekten av den. Ligger en tidligere legeerklæring i konteksten, bruk den som utgangspunkt og gjenta ikke sykehistorien derfra. Ved søknad om forhøyet uførepensjon må det gå fram hva som gjør at arbeidsevnen er lavere enn før.

Vurderingen gjelder søkerens tidligere stilling. Beskriv konkret hvilke arbeidsoppgaver og funksjoner søkeren ikke kan utføre, og hvorfor. SPK har ingen nedre grense på 50 prosent uførhet, så oppgi den graden opplysningene faktisk gir grunnlag for. Diagnosene skal oppgis på både norsk og latin.

Plassen i skjemaet er liten, særlig i feltene som begynner med «Hvis ja» og i tilleggsopplysningene. Skriv kort og presist, i sammenhengende tekst uten punktlister, og gjenta ikke opplysninger på tvers av feltene. «Hvis ja»-feltene fylles bare ut når den tilhørende avkrysningen er ja.

Unngå vage formuleringer som «redusert funksjon» uten nærmere beskrivelse, og spekuler ikke om forhold som ikke framgår av journalen.`
export const felter = [
  { id: "f1", etikett: "Fødselsnummer (11 sifre)", type: "tekst", kilde: "pasient.fnr", seksjon: "Personopplysninger (søkeren)", pdf: { felt: "Foedselsnummer" }, maksTegn: 28 },
  { id: "f2", etikett: "Fullt navn (fornavn, mellomnavn og etternavn)", type: "tekst", kilde: "pasient.navn", seksjon: "Personopplysninger (søkeren)", pdf: { felt: "Fullt navn" }, maksTegn: 70 },

  { id: "f3", etikett: "Årsaken til arbeidsuførheten (diagnoser på norsk og latin)", type: "flerlinje", kilde: "ai", seksjon: A,
    instruks: "Oppgi diagnosen eller diagnosene som er årsak til arbeidsuførheten, hver på norsk og så på latin, hoveddiagnosen først, f.eks. «Prolaps i korsryggen (prolapsus disci intervertebralis lumbalis)». Nevn kort om en diagnose er kommet til siden forrige erklæring.",
    pridokTekst: "Hva er årsaken til arbeidsuførheten? Diagnose(r) på norsk og latin:", pdf: { felt: "Beskriv aarsaken til ufoerheten" }, maksTegn: 400 },
  { id: "f4", etikett: "Søkerens helsetilstand (objektive funn og symptomer)", type: "flerlinje", kilde: "ai", seksjon: A,
    instruks: "Beskriv helsetilstanden slik den er nå: de viktigste symptomene søkeren har, og objektive funn fra siste undersøkelse eller utredning. Skill tydelig mellom symptomer og funn, og si om tilstanden er bedre, verre eller uendret siden forrige erklæring. Tre til fem setninger.",
    pridokTekst: "Hvordan er søkerens helsetilstand? Objektive funn og symptomer:", pdf: { felt: "Beskriv soekerens helsetilstand" }, maksTegn: 400 },
  { id: "f5", etikett: "Behandlingen søkeren har fått siden forrige legeerklæring", type: "flerlinje", kilde: "ai", seksjon: A,
    instruks: "Kort oversikt over behandling, utredning og tiltak siden forrige legeerklæring: hva, hvor og omtrent når, og effekten. Ta bare med det som har skjedd siden sist. Skriv at det ikke er gitt ny behandling når det framgår; tomt når opplysningene ikke sier noe om det.",
    pridokTekst: "Gi en kort oversikt over behandlingen søkeren har fått siden forrige legeerklæring:", pdf: { felt: "Oversikt over behandlinger siden forrige legeerklaering" }, maksTegn: 400 },

  { id: "f6", etikett: "Kan søkeren fremdeles ikke arbeide i sin tidligere stilling? (avkrysning i PDF-en)", type: "avkrysning", kilde: "ai", seksjon: V,
    instruks: "Ja betyr at søkeren fremdeles IKKE kan arbeide i sin tidligere stilling. Nei betyr at søkeren nå kan arbeide i den. Ubesvart når opplysningene ikke gir grunnlag for å vurdere det.",
    ...krys("Kan soekeren arbeide i tidligere stilling") },
  { id: "f7", etikett: "Kan søkeren fremdeles ikke arbeide i sin tidligere stilling? (tekst til Pridok)", type: "flerlinje", kilde: "ai", seksjon: V,
    instruks: "Samme spørsmål som avkrysningen over, besvart i tekst og med samme konklusjon. Begynn med «Ja» (kan fremdeles ikke arbeide i stillingen) eller «Nei», fulgt av én til tre setninger med medisinsk begrunnelse: hvilke arbeidsoppgaver som ikke lar seg utføre, og hvorfor. Tomt når avkrysningen er ubesvart.",
    pridokTekst: "Mener du at søkeren fremdeles ikke kan arbeide i sin tidligere stilling?" },
  { id: "f8", etikett: "Søkerens arbeidsuførhet i prosent (0–100 %)", type: "tekst", kilde: "ai", seksjon: V,
    instruks: "Arbeidsuførheten nå som ett tall med prosenttegn, f.eks. «70 %». Bygg på legens vurdering eller gjeldende grad slik den framgår; ved søknad om forhøyet uførepensjon den nye graden. SPK har ingen nedre grense på 50 prosent. Tomt når opplysningene ikke gir grunnlag for en grad.",
    pridokTekst: "Hvordan vurderer du søkerens uførhet i prosent? (0-100%)", pdf: { felt: "Vurder ufoerheten i prosent" }, maksTegn: 28 },
  { id: "f9", etikett: "Kan søkerens helsetilstand forandre seg?", type: "avkrysning", kilde: "ai", seksjon: V,
    instruks: "Ja når det er grunn til å vente bedring eller forverring, f.eks. ved planlagt behandling eller en progredierende sykdom. Nei når tilstanden vurderes som varig og stabil. Ubesvart når opplysningene ikke gir grunnlag for en prognose.",
    pridokTekst: "Tror du at søkerens helsetilstand kan forandre seg?", ...krys("Kan soekerens helsetilstand forandre seg") },
  { id: "f10", etikett: "Hvis ja (helsetilstanden kan forandre seg), hvordan og når", type: "tekst", kilde: "ai", seksjon: V,
    instruks: "Bare når helsetilstanden kan forandre seg: én kort setning om hva slags endring som ventes (bedring eller forverring) og omtrent når. Ellers tomt.",
    pridokTekst: "Hvis ja, fyll ut hvordan og når:", pdf: { felt: "Hvis ja, hvordan og naar kan helsetilstanden endre seg" }, maksTegn: 78 },
  { id: "f11", etikett: "Er søkeren eller kan søkeren bli i stand til å utføre annet arbeid?", type: "avkrysning", kilde: "ai", seksjon: V,
    instruks: "Ja når opplysningene tilsier at søkeren kan klare annet, bedre tilpasset arbeid nå eller senere. Nei når funksjonsnedsettelsen gjelder alt arbeid. Ubesvart når opplysningene ikke gir grunnlag for å vurdere det.",
    pridokTekst: "Mener du søkeren er eller kan bli i stand til å utføre annet arbeid?", ...krys("Kan soekeren bli i stand til aa utfoere annet arbeid ") },
  { id: "f12", etikett: "Hvis ja (annet arbeid), hvordan og hvilket arbeid", type: "tekst", kilde: "ai", seksjon: V,
    instruks: "Bare når søkeren vurderes i stand til annet arbeid: én kort setning om hva slags arbeid eller hvilke rammer som kan passe (f.eks. stillesittende, redusert stilling) og hva som må til. Ellers tomt.",
    pridokTekst: "Hvis ja, fyll ut hvordan og hvilket arbeid?", pdf: { felt: "Hvis ja, fyll ut hvordan og hvilket arbeid" }, maksTegn: 78 },

  { id: "f13", etikett: "Tilleggsopplysninger", type: "tekst", kilde: "ai", seksjon: T,
    instruks: "Andre opplysninger av betydning for søknaden som ikke er dekket av de øvrige feltene, i én til to korte setninger. Gjenta ikke det som alt står i andre felt. Tomt når det ikke er noe å tilføye.",
    pridokTekst: "Tilleggsopplysninger", pdf: { felt: "Tilleggsopplysninger" }, maksTegn: 105 },
  { id: "f14", etikett: "Er det noe i legeerklæringen som søkeren ikke bør få vite om?", type: "avkrysning", kilde: "manuell", seksjon: T,
    pridokTekst: "Er det noe i legeerklæringen som søkeren ikke bør vite om?", ...krys("Er det noe i legeerklaeringen soekeren ikke boer faa vite om") },
  { id: "f15", etikett: "Hvis ja, oppgi hva søkeren ikke bør få vite", type: "tekst", kilde: "manuell", seksjon: T,
    pridokTekst: "Hvis ja, oppgi hva søkeren ikke bør få vite?", pdf: { felt: "Hvis ja, hva boer soekeren ikke faa vite" }, maksTegn: 78 },

  { id: "f16", etikett: "Dato (dd.mm.åååå)", type: "tekst", kilde: "dato.idag", seksjon: "Signatur", pdf: { felt: "Signatur dato maaned aar" }, maksTegn: 19 },
]
