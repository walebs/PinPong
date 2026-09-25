# PinPong.no — V1 State

**Dato:** 9. juli 2026  
**URL:** https://pinpong.no  
**Repo:** GitHub → Vercel (auto-deploy)

---

## Hva er dette?

En gratis single-file PWA for å finne, filtrere, lagre og melde bordtennisbord i Oslo og Lillestrøm.

---

## Teknisk stack

- **Frontend:** Single-file PWA (`index.html`, ~3800 linjer)
- **Backend:** Vercel serverless functions (`/api/tables.js`, `/api/report.js`)
- **PWA:** Service Worker (`sw.js`) for offline-caching
- **Hosting:** Vercel med `cleanUrls: true`
- **Domene:** pinpong.no

---

## Funksjoner i V1

- Kart over alle bordtennisbord (Oslo + Lillestrøm)
- Filtere: ute/inne, tak, belysning, favoritter, verifisert
- Multi-color filter-dot indikator på FAB-knappen
- Peek-ahead carousel ved swiping mellom bord
- To-språklig (norsk/engelsk) med `data-i18n` / `data-i18n-html`
- Rapportering av feil på bord
- Favoritter lagret lokalt
- Tema-toggle (lys/mørk) med spin-animasjon
- Om PinPong + Personvern-sider
- OG-tags og meta description for deling
- `sitemap.xml` innsendt til Google Search Console

---

## Data

- **67 bord personlig verifisert** av Wale
- Verifisering inkluderer: kvalitet, tak, belysning, type (ute/inne/bar)
- Dekning: Oslo + Lillestrøm (Strømmen inkludert)

---

## Launch

- Postet på **r/norge**: 12k views, 22 upvotes, 24 kommentarer
- Kontaktet **Oslo Street Pingpong** (oslostreetpingpong@outlook.com) for samarbeid
- Google Search Console: sitemap bekreftet, 1 side oppdaget

---

## Kontakt / identitet

- Offentlig kontakt: pinpongnorge@outlook.no
- Utviklet av Wale — ingen personlig info eksponert i appen

---

## Hva som mangler (potensielle V2-ting)

- Brukerinnsending av nye bord
- Kommentarfelt / ratings per bord
- Flere byer (Bergen, Trondheim?)
- Monetisering (ingen nå — bare donasjon)
- Samarbeid med Oslo Street Pingpong-nettverket
