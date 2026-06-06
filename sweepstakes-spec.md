# World Cup 2026 Sweepstakes — App Specification

## Overview

A static, client-side web app that acts as an information portal for a private World Cup 2026 sweepstakes. Players are allocated teams via a random balanced draw; the app fetches live and completed match results from an external API, calculates each player's score automatically, and displays a live leaderboard.

**Design aesthetic:** dark, gold-accented, inspired by online gambling sites — scrolling tickers, live badges, prize pool displays, and an air of barely-regulated excitement.

---

## Architecture

```
Google Sheet (player → team assignments)
        ↓ CSV fetch on page load
    Static site (GitHub Pages / Cloudflare Pages)
        ↓ polling every 5 min (live) / 60 min (idle)
    Cloudflare Worker (caching proxy)
        ↓ fetches once, caches 5 min
    wc2026api.com (match results)
        ↓
    JS score engine → renders leaderboard
```

### Why static?

No server, no database, no hosting costs. All score calculation runs in the browser. The only persistent state is the player-team config, stored in a Google Sheet or a `config.js` file.

---

## File Structure

```
sweepstakes/
├── index.html          # Main portal page
├── css/
│   └── style.css       # All styles — dark gambling aesthetic
└── js/
    ├── config.js       # Player assignments, points rules, API key
    ├── engine.js       # Score calculation logic
    ├── api.js          # API fetcher with mock data fallback
    └── app.js          # UI rendering and polling loop
```

---

## Configuration (`config.js`)

All sweepstakes-specific settings live here. Edit once after the draw; never touch again.

| Field | Description |
|---|---|
| `name` | Sweepstakes display name |
| `currency` | Prize currency symbol |
| `entryFee` | Cost per player (used to calculate pot) |
| `prizes` | Prize split as % of pot — `{ first, second, third }` |
| `points` | Points awarded per outcome (see scoring section) |
| `players` | Object mapping player name → array of 3 team names |
| `api.key` | wc2026api.com API key (`"YOUR_API_KEY_HERE"` triggers mock mode) |
| `api.baseUrl` | API base URL |
| `api.pollInterval` | Polling interval in ms (default: 300,000 = 5 min) |

### Player config example

```js
players: {
  "Dave K.":  ["Argentina", "Brazil", "United States"],
  "Sarah M.": ["France", "Portugal", "Japan"],
}
```

Team names must match the names returned by the API exactly (case-sensitive).

---

## Scoring System (`engine.js`)

### Points per outcome

| Event | Points |
|---|---|
| Group stage win | +3 |
| Group stage draw | +1 |
| Group stage loss | 0 |
| Round of 32 win | +4 |
| Round of 16 win | +5 |
| Quarter-final win | +8 |
| Semi-final win | +12 |
| Final win (champion) | +20 |
| Runner-up (final loss) | +10 |
| Goal scored (all rounds) | +1 per goal |

Points accumulate across all teams owned by a player. Live matches contribute provisional points in real time.

### Tiered draw (balanced allocation)

48 teams are split into 3 tiers of 16 by expected strength. Each player receives one team from each tier, ensuring no player has an all-strong or all-weak hand. Tiers are shuffled independently using a Fisher-Yates shuffle; players are then zipped with each shuffled tier.

---

## API Integration (`api.js`)

**Provider:** [wc2026api.com](https://wc2026api.com)

| Tier | Cost | Requests/day |
|---|---|---|
| Free | £0 | 100 |
| Pro | $4.99 one-off | Unlimited (tournament duration) |

The fetcher normalises the API response to a common internal match format:

```js
{
  id, round, homeTeam, awayTeam,
  homeScore, awayScore,
  status,           // "completed" | "live" | "upcoming"
  penaltiesHomeScore, penaltiesAwayScore
}
```

**Mock data fallback:** if no API key is set, the app loads a hardcoded set of sample matches covering group stage, round of 32, and round of 16 — including two live games. Useful for development and demos.

---

## Rate Limiting — Cloudflare Worker

With multiple players visiting simultaneously and polling every 5 minutes during live games, the free tier (100 req/day) would be exhausted quickly without a caching layer.

**Solution:** a Cloudflare Worker sits between the browser and the API. It fetches from wc2026api.com once and caches the response for 5 minutes. All browser requests are served from cache.

- Cloudflare Worker free tier: 100,000 requests/day
- Keeps API usage to ~288 requests/day regardless of player count

### Worker setup (one-time)

1. Create a free Cloudflare account
2. Create a new Worker and paste the proxy script (see `cloudflare-worker.js` — to be created)
3. Set `CONFIG.api.baseUrl` to your Worker URL

---

## UI — Pages / Tabs

### Leaderboard (default)

- Live games strip at top (shown only when games are in progress, with pulsing red LIVE badge)
- Ranked player table with:
  - Position with medal colours (🥇🥈🥉)
  - Player name + team pills (active teams gold, eliminated teams struck through)
  - Total points
  - Points change since last poll (▲ up / ▼ down)
  - Current prize value (1st / 2nd / 3rd only)
- Clicking any row opens a score breakdown modal showing points per match

### Fixtures

- Full list of all matches, grouped by round
- Status: completed (with score), live (with score + red pulse), upcoming

### Rules

- Points scoring table
- Full player ↔ team assignment list

---

## Sidebar & Right Rail

**Sidebar (desktop only):**
- Remaining teams with accumulated points
- Eliminated teams (struck through)

**Right rail (desktop only):**
- Hot streak callout (player on longest winning run)
- Upcoming fixtures
- Scoring reminder

---

## Hosting

| Option | Cost | Notes |
|---|---|---|
| GitHub Pages | £0 | Push to `main`, enable Pages in repo settings |
| Cloudflare Pages | £0 | Faster CDN, automatic deploys from GitHub |
| Custom domain | ~£8/yr | Optional — via Cloudflare Registrar |

**Total running cost: £0–£8/year** (excluding the optional $4.99 API Pro upgrade).

---

## Deployment Checklist

- [ ] Run the draw and populate `CONFIG.players` in `config.js`
- [ ] Obtain API key from wc2026api.com (free tier sufficient for small groups)
- [ ] Set up Cloudflare Worker caching proxy
- [ ] Update `CONFIG.api.key` and `CONFIG.api.baseUrl`
- [ ] Push to GitHub and enable GitHub Pages
- [ ] Share URL in group chat before tournament starts (11 June 2026)
- [ ] No further maintenance required — scores update automatically

---

## Future Extensions

- **Google Sheet config:** publish player assignments as a public CSV; fetch on load so non-developers can update it without touching code
- **Draw page:** standalone animated reveal page where the host flips team cards one by one; locks and writes assignments to the sheet at the end
- **Chat / reactions:** a simple Supabase real-time channel for in-page banter
- **Push notifications:** Cloudflare Worker sends a push when a player's team scores
- **History log:** store snapshots of the leaderboard after each game to show position changes over time
