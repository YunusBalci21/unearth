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
- Finds appear partly at first and are uncovered gradually. Each one has a condition (Pristine to Fragmentary). Badly damaged finds can only be described by material and broad category, which makes the guess harder.
- Sites are seeded, so every player in a multiplayer lobby and everyone playing the Daily Dig digs an identical site.

### Discoveries & progression
- Curated catalogue of 768 artifacts (24 per country: 10 common, 7 uncommon, 5 rare, 2 legendary) with a period, culture, date, material, estimated value and short history. Everyday finds such as potsherds, coins, oil lamps, spindle whorls, pins and keys sit alongside the famous pieces, so the same kind of object turns up in many countries. This replaces the slow, unreliable Met Museum API lookups.
- Finds are identified the way they are in the field: during a dig each one is only described by material and type ("Terracotta oil lamp", "Silver coin"), with a small-find number instead of a catalogue number. The name, culture, period and history are revealed after the guess.
- Discovery cards, a 3D inspector, a finds tray, rarity-scaled effects and a special banner for legendary finds.
- **The Archive**: a personal collection by region and country that keeps the best condition found for each artifact, marks new finds and shows completion progress.
- Ranks from Volunteer to Legend of the Field.
- **Daily Dig**: five shared sites each day, with a shareable result grid.
- Regional expeditions (Europe, Asia, Africa & Middle East, Americas).
- Guessing accepts common aliases and alternative names (UK, USA, Holland, Persia, Türkiye, Czechia…) and has an accessible autocomplete.

### Interface
A game interface rather than a web page: the excavation fills the screen and the HUD sits around it as instruments.
- **Two materials.** Field-kit surfaces (dark canvas, stitched seams, brass fittings) for things you operate; paper documents (orders, reports, labels, catalogues) for things you read. Hard edges, rubber stamps, ruled ledgers with dotted leaders and measuring-tape progress instead of cards, pills and progress bars.
- **HUD.** Site plate (top left), survey-tape timer (top centre), score (top right), specimen tags for finds (right edge), a depth gauge showing the unit under the cursor with its stratigraphy, depth in metres and clues (bottom left), an equipment belt (bottom centre) and an identification slip (bottom right).
- **Equipment belt.** Painted tool art, an equip animation, a readout with each tool's area, pace and risk, probe charges as pips, and the cursor becomes the equipped tool.
- **Discovery sequence.** Rare finds get a held breath before they come free; the find lifts out, the camera moves in, and a museum-style find record writes itself line by line: small-find number, rarity, field description, material, age, condition, unit and layer, depth, museum value and collection status, with the period sealed until the site is identified. Rare and legendary finds get letterboxing and a rubber stamp. The find then lands on the tray and its tag pops into the HUD.
- **Menus and documents.** A game main menu over the dig site; an expedition order form where choices are circled in ink; site and expedition reports; the Archive as a catalogue with a country index and entry ledger; the leaderboard as a register; a research bench for inspecting finds; a field manual; the expedition board and team roster for multiplayer.
- **Art.** Painted icons, logo, wordmark, favicons and app icons; typography pairs Cinzel (display), Barlow Condensed (interface), Crimson Pro (reading) and IBM Plex Mono (measurements and catalogue numbers), all self-hosted.
- No emoji anywhere, including the share text (plain ✓ / ✗ marks). A test guards against emoji creeping back in.
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
