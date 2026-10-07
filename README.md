# Unearth

**Dig deep, discover history.** Unearth is a free browser archaeology guessing game: excavate a dig site layer by layer, recover the artifacts buried in it, then work out which country the site is in.

Play it at **[playunearth.tech](https://www.playunearth.tech/)**.

- **32 countries, 768 artifacts.** Each country has 24 catalogued finds across four rarities (10 common, 7 uncommon, 5 rare, 2 legendary), from potsherds and coins to royal treasures. During a dig, finds are only described the way an excavator would tag them ("Bronze oil lamp"); their names, cultures and histories are revealed after the guess.
- **Excavation.** An 8×8 trench with three soil layers above bedrock. You have four tools: the shovel (fast but rough), the trowel (careful), the brush (frees exposed finds) and the probe (counts what is buried nearby). Surface sherds and soil stains hint at what lies below.
- **Condition matters.** If you shovel straight into a find you can damage it. Damaged finds score less and may be too broken to identify.
- **Modes.** Solo expeditions (worldwide or limited to one region), the **Daily Dig** (the same five sites for everyone each day) and **multiplayer** lobbies for up to 10 players, where everyone digs identical sites.
- **The Archive.** Every find goes into your personal collection, along with its period, culture, age, estimated value and history. Ranks run from *Volunteer* to *Legend of the Field*.

## Running locally

Requires Node.js 18 or newer.

```bash
npm install
npm start          # http://localhost:3000  (admin: /admin)
npm run dev        # restarts on server changes
npm test           # unit tests for excavation logic, guessing and scoring
```

There is no build step for the Node server. The client is plain ES modules served straight from `client/`, and three.js is served from `node_modules` at `/vendor/three`, so the game never needs a CDN. `npm run build:static` packs the same files into `dist/` for static hosts (see Deploying).

### Environment variables

| Variable     | Default                         | Purpose |
|--------------|---------------------------------|---------|
| `PORT`       | `3000`                          | HTTP / WebSocket port |
| `ADMIN_KEY`  | built-in default (insecure)     | Key for `/admin` and the `?debug=` tools. **Set this in production.** |
| `PUBLIC_URL` | `https://www.playunearth.tech`  | Absolute URL used in `robots.txt` and `sitemap.xml`; this site (with and without `www.`) may call the API cross-origin |
| `ALLOWED_ORIGINS` | none | Extra comma-separated sites that host the game client and call this server, e.g. `https://*.vercel.app` (`*` is a wildcard) |

You can put these in a `.env` file because `dotenv` is loaded at startup.

## Deploying

The game has two parts: static files (HTML, JS, images) and the Node server, which adds multiplayer, the leaderboard and the admin panel over HTTP and WebSockets.

### Render: the whole game

`render.yaml` is a Render Blueprint for one Node web service that serves everything.

- **New service:** in Render choose **New → Blueprint**, pick this repository and enter an `ADMIN_KEY` when asked.
- **Existing web service:** set the build command to `npm ci`, the start command to `npm start` and the health check path to `/healthz`, then add the environment variables above.

The free plan sleeps after 15 minutes without traffic, so the first visit afterwards can take up to a minute. Its disk is not persistent: the leaderboard and bans reset on every deploy or restart.

### Vercel: static client

Vercel cannot run a WebSocket server, so it hosts a static build of the game that talks to the Node server on Render. `vercel.json` already sets the build (`npm run build:static`, output `dist/`) and the `/admin` route.

1. In the Vercel project, add the environment variable `UNEARTH_SERVER_URL` with the Render address, e.g. `https://unearth.onrender.com` (no trailing slash), for Production and Preview.
2. On Render, make sure the Vercel address is allowed: the site in `PUBLIC_URL` is allowed automatically, and `ALLOWED_ORIGINS=https://*.vercel.app` covers preview deployments.
3. Redeploy. Every push then gets a preview URL.

Without `UNEARTH_SERVER_URL`, solo play, the Daily Dig and the Archive still work; multiplayer, the leaderboard and the admin panel report that the server can't be reached.

To try the static build locally: `UNEARTH_SERVER_URL=http://localhost:3000 npm run build:static`, then serve `dist/` from any static file server.

## Project layout

```
server.js                 Express + ws: static files, leaderboard, admin API, multiplayer lobbies
client/
  index.html              Markup, SEO metadata, dialogs
  img/ui/                 Painted UI icons (WebP), shared by the game and the admin panel
  img/cursor/             Tool cursors
  css/unearth.css         Design system and all UI styles
  js/main.js              Boot and app wiring
  js/shared/              Imported by both server and browser
    countries.js          Sites, regions, country names, aliases, guess matching
    rules.js              Version, scoring, lobby options
  js/data/catalog.js      The 768-artifact catalogue (signature pieces; field descriptions)
  js/data/finds/*.js      Regional find lists merged into the catalogue
  js/game/site.js         Pure, seeded excavation logic (unit tested)
  js/game/expedition.js   Round flow for solo, daily and multiplayer play
  js/game/scene.js        three.js trench, strata shader, props, camera
  js/game/artifactModels.js, patterns.js, tools.js, effects.js
  js/ui/                  HUD, dialogs, inspector, results, menus
  js/net/lobby.js         WebSocket lobby client with reconnect
  js/net/endpoint.js      Server address (same site, or window.UNEARTH_SERVER from config.js)
  config.js               Server address for static deployments (rewritten by the static build)
public/                   Fonts, sounds, models, images, favicons, admin panel
scripts/build-static.mjs  Static build for Vercel and other static hosts
render.yaml, vercel.json  Deployment settings
test/                     node:test suites
```

Unearth uses no emoji. Icons are painted artwork: the source images (1254 px PNGs with transparency) live in `img/`, and trimmed 96 px WebP copies used by the page live in `client/img/ui/` (192 px versions for the tool belt, 32/64 px PNG cursors in `client/img/cursor/`). Use `<img class="ico" src="/img/ui/name.webp" alt="">` in markup, or `icon(name)` in JS. The browser-tab favicons in `public/favicons/` are generated from `img/logo-mark.png`; the phone home-screen icons (`apple-touch-icon.png`, `android-chrome-*.png`) from `img/app-icon.png`. `npm test` fails if an emoji appears in the game, admin panel or server.

## Admin panel

Open `/admin` and enter your `ADMIN_KEY`. From there you can watch lobbies and connected players, kick or ban players (bans are by IP and can be temporary or permanent), broadcast a message to everyone online, remove leaderboard entries and launch the game in debug mode. Debug mode exposes `window.__unearth` with an `xray()` helper.

`/admin` is served with `noindex` and is disallowed in `robots.txt`.

## SEO checklist

The page already ships a descriptive title and meta description, a canonical URL, Open Graph and Twitter cards, JSON-LD (`VideoGame`, `WebSite`, `FAQPage`), crawlable text content, `robots.txt` and `sitemap.xml`. To help people find the game:

1. Add the site to [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters), then submit `https://www.playunearth.tech/sitemap.xml`.
2. Check the social cards with a tool such as [opengraph.xyz](https://www.opengraph.xyz/).
3. Run the [Rich Results Test](https://search.google.com/test/rich-results) on the home page.
4. List the game on browser-game directories and communities (itch.io, r/WebGames, r/geography, r/archaeology) so it earns links back.

## License

© YNS Interactive. All rights reserved.
