# Unearth

**Dig deep, discover history.** Unearth is a free browser archaeology guessing game: excavate a dig site layer by layer, recover the artifacts buried in it, then work out which country the site is in.

Play it at **[playunearth.tech](https://www.playunearth.tech/)**.

- **32 countries, 256 artifacts.** Each country has eight catalogued finds across four rarities, with exactly one legendary piece.
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

There is no build step. The client is plain ES modules served straight from `client/`, and three.js is served from `node_modules` at `/vendor/three`, so the game never needs a CDN.

### Environment variables

| Variable     | Default                         | Purpose |
|--------------|---------------------------------|---------|
| `PORT`       | `3000`                          | HTTP / WebSocket port |
| `ADMIN_KEY`  | built-in default (insecure)     | Key for `/admin` and the `?debug=` tools. **Set this in production.** |
| `PUBLIC_URL` | `https://www.playunearth.tech`  | Absolute URL used in `robots.txt` and `sitemap.xml` |

You can put these in a `.env` file because `dotenv` is loaded at startup.

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
  js/data/catalog.js      The 256-artifact catalogue
  js/game/site.js         Pure, seeded excavation logic (unit tested)
  js/game/expedition.js   Round flow for solo, daily and multiplayer play
  js/game/scene.js        three.js trench, strata shader, props, camera
  js/game/artifactModels.js, patterns.js, tools.js, effects.js
  js/ui/                  HUD, dialogs, inspector, results, menus
  js/net/lobby.js         WebSocket lobby client with reconnect
public/                   Fonts, sounds, models, images, favicons, admin panel
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
