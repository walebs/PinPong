# Oppsett: Google Sheets + Forms feltverktøy

## Steg 1 — Importer CSV til Google Sheets

1. Gå til [sheets.google.com](https://sheets.google.com) og lag et nytt ark
2. Fil → Importer → Last opp `bordtennis_data.csv`
3. Velg "Erstatt nåværende ark" og klikk Importer

Du har nå alle 58 bord som rader med tomme felter klar til å fylles inn.

---

## Steg 2 — Publiser arket (slik at appen kan lese det)

1. Fil → Del og eksporter → **Publiser til Internett**
2. Velg "Hele dokumentet" og format **CSV**
3. Klikk Publiser → kopier URL-en du får

Den ser omtrent slik ut:
```
https://docs.google.com/spreadsheets/d/DITT_ID/pub?output=csv
```

4. Åpne `index.html` i en teksteditor
5. Finn denne linjen øverst i `<script>`-blokken:
```js
const SHEETS_CSV_URL = "";
```
6. Lim inn URL-en mellom anførselstegnene:
```js
const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/DITT_ID/pub?output=csv";
```

---

## Steg 3 — Lag feltskjema i Google Forms

1. Gå til [forms.google.com](https://forms.google.com) → nytt skjema
2. Tittel: **Bordtennis feltrapport**
3. Legg til disse spørsmålene:

| Spørsmål | Type | Alternativ |
|---|---|---|
| Hvilket sted? | Rullegardin | (lim inn alle 58 navn) |
| Fant du bordet? | Flervalg | Ja / Nei |
| Antall bord | Kortsvar | (nummer) |
| Materiale | Flervalg | Tre / Betong / Metall / Annet |
| Tilstand (1–5) | Lineær skala | 1 = Dårlig, 5 = Perfekt |
| Under tak? | Flervalg | Ja / Nei |
| Notater | Avsnitt | — |
| Bilde | Filopplasting | Kun bilder, maks 1 fil |

4. Klikk tannhjulet (innstillinger) → sørg for at "Samle inn e-postadresser" er AV

### Koble svar til Sheets:
5. Klikk **Svar**-fanen i Forms → ark-ikonet (📊) → velg ditt eksisterende ark

---

## Steg 4 — Bruk feltskjemaet ute

1. Åpne Forms på telefonen (lagre som snarvei på hjemskjermen)
2. Velg sted fra rullegardinmenyen
3. Fyll ut felter og ta bilde
4. Send inn

Arket oppdateres automatisk. Appen laster fersk data neste gang den åpnes.

---

## Feltene i arket forklart

| Kolonne | Beskrivelse | Gyldige verdier |
|---|---|---|
| `navn` | Stedsnavn — må matche nøyaktig | Se liste |
| `verifisert` | Fant du bordet? | `ja` / `nei` |
| `antall` | Antall bord på stedet | Tall (1, 2, 3…) |
| `materiale` | Bordets materiale | `Tre` / `Betong` / `Metall` |
| `tilstand` | Karakter 1–5 | `1`–`5` |
| `under_tak` | Er bordet under tak? | `ja` / (tom) |
| `notater` | Fri tekst | Hva som helst |
| `bilde_url` | Google Drive delingslink til bilde | `https://drive.google.com/file/d/…` |

### Tips for bilder:
- Ta bilde med telefonen → det lastes automatisk opp via Forms
- Eller: Google Foto → del bilde → kopier link → lim inn i `bilde_url`-kolonnen manuelt

---

## Hva appen viser

Etter at du har fylt inn data vil appen vise:
- ✓ Grønt hake på pinen for verifiserte bord
- ✗ Halvgjennomsiktig pin for "ikke funnet"
- Bilde øverst i infoboksen
- Antall bord, materiale, stjernekarakter
- ☂️ Under tak-badge
- Fremdriftsbar i toppen (X / 58 verifisert)
