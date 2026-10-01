# Mirpurkhas Police — Live Location & Pin Map

Public, no-login map. Officers share live GPS from `/map`; a single admin places pins from a private
`/admin-<slug>` URL. React + Leaflet (OpenStreetMap) + Firebase Realtime Database, deployed on Vercel.

| URL | Who | Can do |
| --- | --- | --- |
| `/map` (and `/` → redirects) | Officers | Start/Stop sharing location, view all officer dots and pins |
| `/admin-<slug>` | Dispatch only | Everything above, plus tap map → create pin; pin popup → Edit / Delete |

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
