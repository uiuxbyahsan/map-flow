# Mirpurkhas Police — Live Location & Pin Map

Public, no-login map. Officers share live GPS from `/map`; a single admin places pins from a private
`/admin-<slug>` URL. React + Leaflet (OpenStreetMap) + Firebase Realtime Database, deployed on Vercel.

| URL | Who | Can do |
| --- | --- | --- |
| `/map` (and `/` → redirects) | Officers | Start/Stop sharing location, view all officer dots and pins |
| `/admin-<slug>` | Dispatch only | Everything above, plus: place search; tap map → point pin; draw polygon / rectangle / circle areas; popup → Edit / Delete; "Edit layers" tool → drag area vertices |

## 1. Firebase setup (once)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Spark/free plan is fine).
2. **Build → Realtime Database → Create database** (pick a region, start in locked mode).
3. **Rules** tab → paste the contents of [`database.rules.json`](database.rules.json) → **Publish**.
4. **Project settings → Your apps → Web (`</>`)** → register an app and copy the config values.

## 2. Local development

```bash
cp .env.example .env.local   # then fill in the Firebase values
npm install
npm run dev
```

`.env.local` in this folder already has a generated admin slug hash; the admin URL is noted in a comment in that file.
To rotate it: pick a new slug (`openssl rand -hex 12`), put `printf %s '<slug>' | shasum -a 256` into
`VITE_ADMIN_SLUG_HASH`, redeploy. The old admin URL stops working immediately.

Geolocation needs HTTPS (or `localhost`). To test on a phone, use the Vercel preview URL.

## 3. Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel (framework preset: **Vite**).
2. **Settings → Environment Variables**: add every `VITE_*` variable from `.env.local`.
3. Deploy. `vercel.json` rewrites all paths to the SPA so `/map` and `/admin-…` work on refresh.

## Pins and areas

Admin tools (admin view only; officers see everything read-only):

- **Search box** (top): place search via OpenStreetMap Nominatim, limited to the district. Debounced 500 ms,
  one request at a time. Picking a result only moves the map.
- **Point pin**: tap the map.
- **Polygon / Rectangle / Circle**: drawing toolbar on the left (Leaflet.draw). When the shape is finished
  the same form opens: type, label, optional note.
- **Edit / Delete**: tap any pin or area → popup → *Edit / Delete*.
- **Reshape areas**: toolbar *Edit layers* → drag vertices / circle handles → *Save*.

Types: incident, checkpoint, patrol point, cordon, search zone, other.

Data model (`/pins/{id}`):

```
shapeType: "point" | "polygon" | "rectangle" | "circle"   (missing = "point", for older pins)
type, label, note, createdAt, updatedAt?
lat, lng                  point, or circle centre
radiusMeters              circle only
coordinates: [{lat, lng}] polygon / rectangle
```

**After changing `database.rules.json`, re-publish it in the Firebase console**, or writes using the new
fields/types are rejected.

## Basemap (map tiles)

The map uses **MapTiler** (Streets v2) for tiles. Set a key in `.env.local` and in Vercel:

```
VITE_MAPTILER_KEY=your_key_here
```

Get a free key at https://cloud.maptiler.com. **If the key is missing, the app falls back to the public
OpenStreetMap tile server** (fine for dev, but rate-limited — not for production) and logs a console warning,
so the map is never blank. Required attribution (© MapTiler © OpenStreetMap contributors) is kept automatically.

### Optional: Google basemap (richer labels)

Off by default. To enable:

```
VITE_BASEMAP=google
VITE_GOOGLE_MAPS_KEY=your_google_key
```

Google tiles are shown under Leaflet via `leaflet.gridlayer.googlemutant` (the ToS-compliant way — Leaflet
stays the map engine). When a Google key is set, the **admin view** gets a small Streets / Google toggle
(top-right); the officer view uses whatever the env default is. Google requires a **billing-enabled Google
Cloud project** — restrict the API key to your production domain (HTTP referrer restriction) and set a
monthly budget alert. Without a Google key the toggle is hidden and the app uses Streets.

**Set all `VITE_*` keys in the Vercel project settings too**, or the deployed site won't have them.

## Behaviour notes

- **Update cadence:** while sharing, the device writes its last GPS fix every 8 s (heartbeat even when
  stationary). No update for 5 min → dot turns grey ("stale"). "Stop Map" deletes the officer's record at once.
- **Abandoned records:** if a phone just closes the tab, its dot goes stale, is hidden after 12 h, and is
  deleted by the admin view's housekeeping.
- **Overlap:** officers and pins share one cluster layer. Tapping a count badge zooms in; if the items are
  within ~30 m of each other (or the map is fully zoomed) it opens one popup listing all of them.
- **Phones in the background:** mobile browsers pause GPS when the screen locks or the browser is
  backgrounded. The dot will go stale until the officer reopens the page. Only a native app fixes this.

## Items to flag to the client

1. **Security is URL-only.** There is no authentication. Anyone who has the site URL can write to
   `/officers`, and anyone who learns the Firebase config (public in every web app) could also write to
   `/pins` directly, bypassing the admin URL. The rules validate data *shape* (types, lengths, pin types)
   but cannot restrict *who* writes. Acceptable for a pilot; before wider rollout, add Firebase Auth
   (even anonymous auth + an admin custom claim) and tighten the rules.
2. **Anonymous dots.** No identifier is attached to officer markers, even for admin. If dispatch needs to
   know who a dot is, that requires an identifier and reopens the login decision.
3. **"Start Map" label.** Kept as requested. Because the label alone doesn't say it broadcasts location,
   the officer view shows a one-line note under the button ("Start Map shares your live location on this
   map until you tap Stop Map") and a "Your live location is being shared" indicator while active, so
   officers know what the button does.
4. **Free tier limits:** Spark plan allows 100 simultaneous connections, 10 GB/month download. Fine for a
   pilot; revisit for a large force.
