# PinPong

Map of public ping pong tables in Oslo and Lillestrøm, with photos, conditions and directions.

**Live:** [pinpong.no](https://pinpong.no)

## Features

- Map with clustered markers, filters (indoor/outdoor, covered, lighting, verified, favourites) and search
- Table cards with photo and details; swipe left/right to jump to the nearest table in that direction
- "Nearest tables" strip based on GPS
- Favourites, light/dark theme, Norwegian/English
- Forms to suggest a new table or report a problem (sent by email)
- Installable PWA; map tiles and photos are cached by a service worker

## Stack

- Vanilla JavaScript (ES modules), HTML, CSS: no framework or build step
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
