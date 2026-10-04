// Where the multiplayer and leaderboard server lives.
// Empty means the same site that serves the game (the Node server, e.g. on Render).
// The static build used for Vercel (npm run build:static) rewrites this file from
// the UNEARTH_SERVER_URL environment variable, e.g. "https://unearth.onrender.com".
window.UNEARTH_SERVER = window.UNEARTH_SERVER || '';
