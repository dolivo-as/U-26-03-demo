# U-26-03 Porteføljeverktøy – DEMO

> **Demo – fiktive data, ingen innlogging.**

Dette er en statisk demo av porteføljeverktøyet (PEP-prototypen) for testing på mobil.

- **Alle data er fiktive eksempeldata** (merket «EKS»/«EKSEMPEL»). Ingen ekte prosjekter, personer eller dokumenter.
- **Ingen innlogging.** Rollen velges fritt i menyen «Demo-rolle». Alle med lenken kan se siden.
- **Ingen server.** Alle API-kall besvares i nettleseren fra `demo-data.json`, som er forhåndsgenerert fra de fiktive eksempeldataene.
- **Endringer lagres bare lokalt i din nettleser** (localStorage). Ingen andre ser dem. Knappen «Nullstill demo» sletter dem.
- Ingen hemmeligheter, nøkler eller innloggingsoppsett ligger i dette repoet.

Demoen er ikke selve produktet. Utviklingen skjer i et eget privat repo.

## Begrensninger i demoen

- Revisjonsloggen er et forhåndsgenerert utdrag og oppdateres ikke når du gjør endringer.
- Tiltaksplaner, KI-analyse og usikkerhetsberegning er statiske eller lagres ikke.
- Nye prosjekter vises i listen, men har ikke eget prosjektkort.
- Eksportene er forhåndsgenererte fra eksempeldataene.

## Filer

- `index.html`, `app.js`, `app.css` – brukergrensesnittet
- `demo.js`, `demo.css` – demomodus (fetch-mock, banner)
- `demo-data.json` – fiktive eksempeldata
