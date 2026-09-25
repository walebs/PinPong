# PinPong

An intuitive and responsive app to easily find, filter and save public ping pong tables in Oslo and Lillestrøm, with photos, conditions and directions.

**Live:**

[pinpong.no](https://pinpong.no)

## Features

- Map with clustered markers, filters (indoor/outdoor, covered, lighting, verified, favourites) and search
- Table cards with photo and details; swipe left/right to jump to the nearest table in that direction
- "Nearest tables" strip based on GPS
- Favourites, light/dark theme, Norwegian/English
- Forms to suggest a new table or report a problem (sent by email)
- Installable PWA; map tiles and photos are cached by a service worker
- Hardened form endpoint, SRI-pinned dependencies and security headers (see [Security and privacy](#security-and-privacy))

## Stack

- Vanilla JavaScript (ES modules), HTML, CSS: no framework
- [Leaflet](https://leafletjs.com) with markercluster and rotate plugins, CARTO map tiles
- Vercel for hosting and serverless functions (Node.js)
- Google Sheets as a lightweight CMS for table data
- [Resend](https://resend.com) for email

## Structure

```
index.html            markup only
css/                  base, map, controls, sheet (table card), pages, motion
js/
  main.js             entry point: startup, data loading, click handling
  state.js            app state, filters and favourites
  data.js             fetches and parses the table list (CSV)
  places.js           seed coordinates and search areas
  map.js              Leaflet map and tile layers
  markers.js          marker icons, clustering and highlighting
  BottomSheet.js      the table card
  CardCarousel.js     swiping between cards
  cardContent.js      card HTML shared by the card and the swipe preview
  location.js         GPS, user position and compass
  nearby.js, search.js, filters.js, pages.js, forms.js, theme.js, i18n.js, …
api/
  tables.js           proxies and caches the Google Sheet
  report.js           sends form submissions by email
sw.js                 service worker (tile and photo cache)
```

## How it works

**Data.** Tables are kept in a Google Sheet published as CSV. `api/tables.js` fetches it and caches the result in memory and on Vercel's CDN, so the sheet can be edited without a deploy. The app shows seed coordinates immediately and fills in details when the sheet arrives.

**Swipe navigation.** Swiping a card right or left opens the nearest table east or west of the current one. As soon as a horizontal drag starts, the next card is rendered off-screen and moves with the finger, so the transition has no loading gap.

**Caching.** The service worker caches map tiles and photos as they are viewed. On load, only photos for the closest tables are preloaded, plus the neighbours of whichever card is open.

## Security and privacy

The app has no accounts and stores no personal data on a server, so the attack surface is small: mainly the form endpoint and third-party scripts.

**Form endpoint (`api/report.js`)**
- Only accepts requests from pinpong.no (and Vercel previews); others get `403`
- Rate limited per IP (best effort, in memory) on top of a per-device daily limit in the app
- Validates every field server-side: type, length, email format; line breaks are stripped from the subject
- Attachments must be real JPEG, PNG, WebP or HEIC, checked by file signature rather than the declared type
- Errors are logged server-side; the client only gets a generic message
- Secrets (`RESEND_API_KEY`, sheet URL) live in Vercel environment variables, never in the repo or the browser

**Frontend**
- All sheet and user text is HTML-escaped before rendering
- CDN scripts and styles are pinned to exact versions with Subresource Integrity hashes
- Response headers: HSTS, `frame-ancestors 'none'` (no clickjacking), `nosniff`, a strict referrer policy, and a Permissions-Policy that limits geolocation to the site and turns off APIs it doesn't use (microphone, payment, USB)

**Privacy**
- GPS position is only used in the browser and never sent anywhere
- Favourites and settings are kept in `localStorage`; no cookies, analytics or trackers
- An email address is only collected if the user submits a form, and only to reply

## Running locally

ES modules need to be served over HTTP:

```bash
npx serve .
```

The `/api` routes need the Vercel CLI (`vercel dev`) and these environment variables:

| Variable          | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `SHEETS_CSV_URL`  | Published CSV link of the Google Sheet   |
| `RESEND_API_KEY`  | API key for sending email                |
| `RECIPIENT_EMAIL` | Where form submissions are sent          |
