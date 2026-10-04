# Changelog

## 1.0.1

A full overhaul of the game loop, interface and server. The core idea is unchanged: dig up artifacts, then guess the country.

### Excavation
- New stratified dig site: an 8×8 grid with three soil layers (topsoil, fill, occupation layer) above bedrock. Each site uses a sand, dirt or soil palette, and the trench walls show coloured strata.
- Four tools with clear trade-offs:
  - **Shovel** clears 3×3 at a time but can damage a find it hits.
  - **Trowel** removes one cell, one layer at a time, and is safe.
  - **Brush** frees an exposed find over several strokes. Rarer finds need more strokes.
  - **Probe** gives three readings per site, each counting the buried finds nearby.
- Clues: surface sherds above most finds, and soil stains over deep ones.
- Finds appear partly at first and are uncovered gradually. Each one has a condition (Pristine to Fragmentary). Badly damaged finds hide their name, which makes the guess harder.
- Sites are seeded, so every player in a multiplayer lobby and everyone playing the Daily Dig digs an identical site.

### Discoveries & progression
- Curated catalogue of 256 artifacts (8 per country, one legendary each) with a period, culture, date, material, estimated value and short history. This replaces the slow, unreliable Met Museum API lookups.
- Discovery cards, a 3D inspector, a finds tray, rarity-scaled effects and a special banner for legendary finds.
- **The Archive**: a personal collection by region and country that keeps the best condition found for each artifact, marks new finds and shows completion progress.
- Ranks from Volunteer to Legend of the Field.
- **Daily Dig**: five shared sites each day, with a shareable result grid.
- Regional expeditions (Europe, Asia, Africa & Middle East, Americas).
- Guessing accepts common aliases and alternative names (UK, USA, Holland, Persia, Türkiye, Czechia…) and has an accessible autocomplete.

### Interface
- Complete redesign with an archaeological identity: parchment, stone, brass, survey grids and a photo-scale motif, using self-hosted Cinzel, Crimson Pro and IBM Plex Mono fonts.
- New menus, setup, HUD, tool rail with tooltips, round results, final summary with a site log, leaderboard, settings, pause menu and an in-game field guide.
- Native accessible dialogs, keyboard play (arrow keys, 1–4 for tools, Q/E/R for the camera, G to guess, Esc to pause), screen-reader announcements, visible focus states and a reduced-motion option.
- Responsive layouts for desktop, laptop, tablet and phone.
- Loading, empty and error states throughout.

### Fixes
- The menu no longer waits for every sound to load before responding, and music streams.
- Fixed a crash in the share dialog.
- Pausing now stops the timer, and the game pauses automatically when the tab is hidden.
- "New expedition" now keeps your chosen settings.
- Multiplayer rounds with no time limit no longer stall when a player leaves.
- Multiplayer rounds are timed by the server and scored there. Lobby settings are validated.
- Page scrolling and form input now work on mobile (a global touch handler had blocked them).
- Corrected the social preview image URL and size and the web-manifest icon paths.
- Removed the outdated tutorial videos and an inaccurate tip.

### Security
- The server now serves only `client/` and `public/`. Previously `server.js`, `package.json`, `leaderboard.json` and `bans.json` (which held player IPs) were publicly downloadable.
- Fixed stored XSS through player, lobby and leaderboard names in the game and admin panel.
- Leaderboard submissions are validated against the scoring rules. Text inputs are sanitised and rate limited.
- Debug tools now require the admin key (`?debug=<ADMIN_KEY>`).
- The admin panel can moderate the leaderboard. It is no-index and cannot be framed, and its key is compared in constant time.

### SEO
- Descriptive title and meta description, canonical URL, absolute Open Graph and Twitter images, JSON-LD (`VideoGame`, `WebSite`, `FAQPage`), crawlable on-page content, `robots.txt` and `sitemap.xml`.

### Technical
- Restructured into `client/` (ES modules) and `server.js`, with shared rule and country modules imported by both.
- Removed Vite. three.js is vendored from `node_modules`. Added gzip compression.
- Unit tests for excavation, guess matching and scoring (`npm test`).
