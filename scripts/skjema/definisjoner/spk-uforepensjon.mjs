// SPK S030 «Legeerklæring ved søknad om uførepensjon». Lagt inn 12.11.2026 med scripts/skjema/legg-inn.mjs.
// Eksempel på en definisjon — databasen er fasiten etter at admin har rettet i skjemaet på /admin/skjema.
// «Underskrift av lege» i PDF-en er bevisst ikke koblet: et maskinskrevet navn tar plassen for signaturen.
export const kategori = "Pensjon og forsikring"
const A = "Om uførheten", U = "Ulykke", V = "Vurdering av uførheten", T = "Tilleggsopplysninger"
const krys = (navn) => ({ pdf: { felt: navn, valg: "Ja" }, pdfNei: { felt: navn, valg: "Nei" } })
export const navn = "SPK - Legeerklæring ved søknad om uførepensjon"
export const beskrivelse = "SPK-skjema S030 ved første søknad om uførepensjon"
export const prompt = `Dette er en legeerklæring til støtte for søknad om uførepensjon fra Statens pensjonskasse (SPK), som gjelder ansatte i staten og andre virksomheter med medlemskap i SPK. Mottaker er SPK, som skal vurdere om vilkårene for uførepensjon er oppfylt. Erklæringen skal dokumentere årsaken til arbeidsuførheten, når den oppsto, og hvor mye arbeidsevnen er nedsatt i søkerens nåværende stilling. Skjemaet gjelder første søknad, ikke forlengelse eller forhøyelse.

Vurderingen gjelder søkerens nåværende stilling. Beskriv konkret hvilke arbeidsoppgaver og funksjoner søkeren ikke kan utføre, og hvorfor, framfor å gjenta diagnosen. SPK har ingen nedre grense på 50 prosent uførhet, så oppgi den graden opplysningene faktisk gir grunnlag for, også når den er lav.

Hoveddiagnosen skal oppgis på både norsk og latin. Gi presise datoer eller måned og år der skjemaet spør om tidspunkt, og skriv ikke et tidspunkt som ikke framgår av opplysningene.

Plassen i skjemaet er liten. Skriv kort og presist, i sammenhengende tekst uten punktlister, og gjenta ikke opplysninger på tvers av feltene. Feltene som begynner med «Hvis ja» skal bare fylles ut når den tilhørende avkrysningen er ja. Den fullstendige listen over sykmeldingsperioder hører hjemme på fortsettelsesarket, ikke i skjemaets egen rubrikk.

Unngå vage formuleringer som «redusert funksjon» uten nærmere beskrivelse, og spekuler ikke om forhold som ikke framgår av journalen.`
export const felter = [
  { id: "f1", etikett: "Fødselsnummer (11 sifre)", type: "tekst", kilde: "pasient.fnr", seksjon: "Personopplysninger (søkeren)", pdf: { felt: "Foedselsnummer" }, maksTegn: 27 },
  { id: "f2", etikett: "Fullt navn (fornavn, mellomnavn og etternavn)", type: "tekst", kilde: "pasient.navn", seksjon: "Personopplysninger (søkeren)", pdf: { felt: "Fullt navn" }, maksTegn: 69 },

  { id: "f3", etikett: "Hovedårsaken til arbeidsuførheten (diagnose på norsk og latin)", type: "flerlinje", kilde: "ai", seksjon: A,
    instruks: "Oppgi diagnosen som er hovedårsak til arbeidsuførheten, først på norsk og så på latin, f.eks. «Prolaps i korsryggen (prolapsus disci intervertebralis lumbalis)». Én hoveddiagnose. Legg til én kort setning om hva tilstanden innebærer bare hvis det trengs for å forstå den.",
    pridokTekst: "Hva er hovedårsaken til arbeidsuførheten? Diagnose på norsk og latin:", pdf: { felt: "Beskriv aarsaken til arbeidsufoerheten" }, maksTegn: 400 },
  { id: "f4", etikett: "Eventuelle medvirkende medisinske årsaker", type: "flerlinje", kilde: "ai", seksjon: A,
    instruks: "Oppgi andre diagnoser eller medisinske tilstander som bidrar til arbeidsuførheten, med én kort forklaring på hvordan hver bidrar. La stå tomt når det ikke foreligger medvirkende årsaker.",
    pridokTekst: "Før opp eventuelle medvirkende medisinske årsaker:", pdf: { felt: "Foer opp eventuelle medvirkende aarsaker" }, maksTegn: 400 },
  { id: "f5", etikett: "Sykdommens utvikling og symptomer", type: "flerlinje", kilde: "ai", seksjon: A,
    instruks: "Gi en kort kronologisk beskrivelse av sykdomsutviklingen fra debut til i dag, med de viktigste symptomene, forverringer, behandling som er forsøkt og effekten av den. Tre til fem setninger.",
    pridokTekst: "Hvordan har sykdommen utviklet seg og hvilke symptomer har den gitt?", pdf: { felt: "Beskriv sykdommens utvikling og syptomer" }, maksTegn: 400 },
  { id: "f6", etikett: "Når begynte sykdommen?", type: "tekst", kilde: "ai", seksjon: A,
    instruks: "Tidspunktet for sykdomsdebut, som dato (dd.mm.åååå), måned og år, eller årstall — så presist som opplysningene gir grunnlag for. Kun tidspunktet, ingen forklaring.",
    pridokTekst: "Når begynte sykdommen?", pdf: { felt: "Naar begynte sykdommen" }, maksTegn: 104 },
  { id: "f7", etikett: "Når ble søkeren ufør på grunn av sykdommen?", type: "tekst", kilde: "ai", seksjon: A,
    instruks: "Tidspunktet da arbeidsevnen ble nedsatt på grunn av sykdommen, vanligvis første dag i den sammenhengende sykmeldingen som har ført fram til søknaden. Dato (dd.mm.åååå) når den er kjent, ellers måned og år. Kun tidspunktet.",
    pridokTekst: "Når ble søkeren ufør på grunn av sykdommen?", pdf: { felt: "Naar ble soekeren ufoer paa grunn av sykdommen" }, maksTegn: 104 },
  { id: "f8", etikett: "Har søkeren vært sykmeldt for samme sykdom tidligere?", type: "avkrysning", kilde: "ai", seksjon: A,
    instruks: "Ja når det framgår at søkeren har hatt tidligere sykmeldingsperioder for den samme sykdommen, før den sykmeldingen som har ført fram til søknaden. Nei når det framgår at det ikke har vært slike. Ubesvart når opplysningene ikke sier noe om det.",
    pridokTekst: "Har søkeren vært sykmeldt for samme sykdom tidligere?", ...krys("Har soekeren vaert sykemeldt for sykdommen tidligere") },
  { id: "f9", etikett: "Hvis ja (sykmeldt tidligere), oppgi når", type: "tekst", kilde: "ai", seksjon: A,
    instruks: "Bare når søkeren har vært sykmeldt for samme sykdom tidligere: periodene sammenfattet svært kort på én linje, f.eks. «03.2022–06.2022 og 09.2023–01.2024». Er det mange perioder, oppgi tidsrommet de faller innenfor og skriv «se fortsettelsesark». Ellers tomt.",
    pridokTekst: "Hvis ja, oppgi når:", pdf: { felt: "Hvis ja oppgi naar" }, maksTegn: 78 },
  { id: "f10", etikett: "Har søkeren vært gjennom undersøkelser ved andre institusjoner eller hos spesialist?", type: "avkrysning", kilde: "ai", seksjon: A,
    instruks: "Ja når det framgår at søkeren er undersøkt eller utredet på sykehus, ved annen institusjon eller hos spesialist for sykdommen. Nei når det framgår at det ikke er gjort. Ubesvart når opplysningene ikke sier noe om det.",
    pridokTekst: "Har søkeren vært gjennom undersøkelser ved andre institusjoner eller hos spesialist?", ...krys("Har soekeren vaert gjennom undersoekelser ved andre institusjoner eller hos spesialist") },
  { id: "f11", etikett: "Hvis ja (undersøkelser), før opp hvilke", type: "flerlinje", kilde: "ai", seksjon: A,
    instruks: "Bare når søkeren er undersøkt andre steder: hvor og når, og hva slags undersøkelse eller utredning, f.eks. «MR korsrygg, Aleris, 04.2023. Nevrologisk poliklinikk, Ahus, 09.2023». Ingen gjengivelse av funn. Ellers tomt.",
    pridokTekst: "Hvis ja, før opp hvilke: (Legg ved kopi av epikrise for undersøkelsene)", pdf: { felt: "Hvis ja oppgi hvilke undersoekelser" }, maksTegn: 300 },

  { id: "f12", etikett: "Skyldes uførheten et ulykkestilfelle?", type: "avkrysning", kilde: "ai", seksjon: U,
    instruks: "Ja bare når det framgår at arbeidsuførheten skyldes en ulykke eller skade. Nei når årsaken er sykdom uten forutgående ulykke. Ubesvart når årsaksforholdet er uklart.",
    pridokTekst: "Skyldes uførheten en ulykkestilfelle?", ...krys("Skyldes ufoerheten et ulykkestilfelle") },
  { id: "f13", etikett: "Hvis ja (ulykke), hvordan skjedde ulykken?", type: "tekst", kilde: "ai", seksjon: U,
    instruks: "Bare når uførheten skyldes en ulykke: én setning om når og hvordan ulykken skjedde. Ellers tomt.",
    pridokTekst: "Hvis ja: Hvordan skjedde ulykken?", pdf: { felt: "Hvis ja hvordan skjedde ulykken" }, maksTegn: 78 },
  { id: "f14", etikett: "Skjedde ulykken i tjenesten?", type: "avkrysning", kilde: "ai", seksjon: U,
    instruks: "Besvares bare når uførheten skyldes en ulykke: Ja når ulykken skjedde i arbeidet eller tjenesten, Nei når den skjedde utenfor. Ubesvart når det ikke har vært noen ulykke, eller når det ikke framgår hvor den skjedde.",
    pridokTekst: "Skjedde ulykken i tjenesten?", ...krys("Skjedde ulykken i tjenesten") },

  { id: "f15", etikett: "Søkerens arbeidsuførhet i prosent (0–100 %)", type: "tekst", kilde: "ai", seksjon: V,
    instruks: "Arbeidsuførheten i søkerens nåværende stilling som ett tall med prosenttegn, f.eks. «50 %». Bygg på legens vurdering eller gjeldende sykmeldingsgrad slik den framgår. SPK har ingen nedre grense på 50 prosent. Tomt når opplysningene ikke gir grunnlag for en grad.",
    pridokTekst: "Hvordan vurderer du søkerens arbeidsuførhet i prosent? (0-100%)", pdf: { felt: "Vurder ufoerheten i prosent" }, maksTegn: 28 },
  { id: "f16", etikett: "Medisinsk begrunnet vurdering av hvordan søkeren vil fungere i sin nåværende stilling", type: "flerlinje", kilde: "ai", seksjon: V,
    instruks: "Vurder funksjonen opp mot kravene i søkerens nåværende stilling: hvilke arbeidsoppgaver som ikke lar seg utføre og hvorfor, hva som fortsatt er mulig, og om nedsettelsen ventes å vare. Begrunn medisinsk og konkret. Tre til fem setninger.",
    pridokTekst: "Gi en medisinsk begrunnet vurdering av hvordan søkeren vil fungere i sin nåværende stilling;", pdf: { felt: "Gi medisinsk vurdering av hvordan soeker vil fungere i naavaerende stilling" }, maksTegn: 400 },
  { id: "f17", etikett: "Er eller vil søkeren bli skikket til å gå over i annet arbeid?", type: "avkrysning", kilde: "ai", seksjon: V,
    instruks: "Ja når opplysningene tilsier at søkeren kan klare annet, bedre tilpasset arbeid nå eller senere. Nei når funksjonsnedsettelsen gjelder alt arbeid. Ubesvart når opplysningene ikke gir grunnlag for å vurdere det.",
    pridokTekst: "Tror du at søkeren er eller vil bli skikket til å gå over i annet arbeid?", ...krys("Tror du soekeren er eller vil kunne gaa over i annet arbeid") },
  { id: "f18", etikett: "Hvis ja (annet arbeid), hva slags arbeid?", type: "tekst", kilde: "ai", seksjon: V,
    instruks: "Bare når søkeren vurderes skikket til annet arbeid: hva slags arbeid eller hvilke rammer som kan passe (f.eks. stillesittende, uten tunge løft, redusert stilling), og når det eventuelt kan bli aktuelt. Én til to setninger. Ellers tomt.",
    pridokTekst: "Hvis ja, hva slags arbeid?", pdf: { felt: "Hvis ja hva slags arbeid" }, maksTegn: 300 },

  { id: "f19", etikett: "Tilleggsopplysninger", type: "flerlinje", kilde: "ai", seksjon: T,
    instruks: "Andre opplysninger av betydning for søknaden som ikke er dekket av de øvrige feltene, f.eks. planlagt behandling eller utredning, prognose, eller forhold ved arbeidssituasjonen. Gjenta ikke det som alt står i andre felt. Tomt når det ikke er noe å tilføye.",
    pridokTekst: "Tilleggsopplysninger", pdf: { felt: "Tilleggsopplysninger" }, maksTegn: 400 },
  { id: "f20", etikett: "Er det noe i legeerklæringen som søkeren ikke bør få vite om?", type: "avkrysning", kilde: "manuell", seksjon: T,
    pridokTekst: "Er det noe i legeerklæringen som søkeren ikke bør vite om?", ...krys("Er det noe i legeerklaeringen soeker ikke boer vite om") },
  { id: "f21", etikett: "Hvis ja, oppgi hva søkeren ikke bør få vite", type: "tekst", kilde: "manuell", seksjon: T,
    pridokTekst: "Hvis ja, oppgi hva søkeren ikke bør få vite?", pdf: { felt: "Hvis ja hva boer soeker ikke vite om" }, maksTegn: 78 },

  { id: "f22", etikett: "Dato (dd.mm.åååå)", type: "tekst", kilde: "dato.idag", seksjon: "Signatur", pdf: { felt: "Signert dato maaned aar" }, maksTegn: 19 },

  { id: "f23", etikett: "Sykmeldingsperioder for samme sykdom", type: "flerlinje", kilde: "ai", seksjon: "Fortsettelsesark",
    instruks: "List alle kjente sykmeldingsperioder for sykdommen som er årsak til uførheten, eldste først, én per linje: fra-dato–til-dato, sykmeldingsgrad og diagnose. Tomt når ingen sykmeldingsperioder framgår.",
    pdf: { ark: true } },
]
