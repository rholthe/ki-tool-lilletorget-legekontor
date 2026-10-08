/**
 * Forhåndsutfylt forslag i admin-skjemaet for meldinger, brukt når ingen
 * meldinger er publisert ennå. Admin leser gjennom og publiserer selv.
 */
export const SIKKERHETSMELDING_FORSLAG = {
  tittel: "Nye sikkerhetsrutiner i legeassist",
  innhold: `Legeassist behandler pasientopplysninger, og vi strammer derfor inn sikkerheten i tråd med Normen. Endringene gjelder alle brukere.

### Innlogging

- Du må logge inn **hver dag**.
- Er du borte fra legeassist i **én time**, blir du logget ut automatisk.
- Lukker du nettleseren, blir du også logget ut.

### Konsultasjonene dine går ikke tapt

- Når du blir logget ut automatisk eller lukker nettleseren, **låses** konsultasjonene på maskinen. De er tilbake så snart du logger inn igjen.
- Trykker du selv på **Logg ut**, blir du bedt om å bekrefte. Da **slettes** alle konsultasjonene dine på maskinen.
- Som før slettes konsultasjoner automatisk etter 24 timer.

### To-faktor blir snart obligatorisk

Snart må alle logge inn med en engangskode fra mobilen i tillegg til passordet. Du får beskjed om datoen.

Gjør dette allerede nå:

1. Last ned en autentiseringsapp på mobilen, for eksempel **Microsoft Authenticator**, **Google Authenticator** eller **YubiKey Authenticator**. Appene er gratis i App Store og Google Play.
2. I legeassist går du til **Innstillinger → Konto** og trykker **Aktiver 2FA**.
3. Skann QR-koden med appen, og skriv inn den sekssifrede koden appen viser.

Har du allerede slått på to-faktor, trenger du ikke gjøre noe mer.

Spørsmål? Ta kontakt med administrator.`,
}
