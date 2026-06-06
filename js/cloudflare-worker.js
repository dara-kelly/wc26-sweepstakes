// ============================================================
// CLOUDFLARE WORKER — caching proxy for football-data.org v4
// ============================================================
//
// SETUP (one-time, ~5 minutes):
//   1. https://dash.cloudflare.com → Workers & Pages → Create Worker
//   2. Paste this file
//   3. Settings → Variables → add:
//        FDO_API_KEY  =  your_football_data_org_key
//   4. Deploy. Copy your worker URL.
//   5. In config.js set CONFIG.api.baseUrl to your worker URL
//
// WHY THIS EXISTS:
//   football-data.org free tier = 10 req/min.
//   With several players polling simultaneously during a live game,
//   you'd hit that instantly. This worker caches the response for
//   60s (live) or 5min (idle), so upstream sees 1 req per interval
//   regardless of how many browsers are open.
// ============================================================

const UPSTREAM_URL = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";

const TTL_LIVE    = 60;   // seconds — during a live match
const TTL_DEFAULT = 300;  // seconds — between matches

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// football-data.org stage → our round label
const STAGE_MAP = {
  "GROUP_STAGE":    "Group Stage",
  "ROUND_OF_32":    "Round of 32",
  "LAST_32":        "Round of 32",
  "ROUND_OF_16":    "Round of 16",
  "LAST_16":        "Round of 16",
  "QUARTER_FINALS": "Quarter-final",
  "SEMI_FINALS":    "Semi-final",
  "THIRD_PLACE":    "Third place",
  "FINAL":          "Final",
};

function normaliseStatus(s) {
  if (!s) return "upcoming";
  switch (s.toUpperCase()) {
    case "FINISHED": case "FT": case "AET": case "PEN": return "completed";
    case "IN_PLAY": case "PAUSED": case "HALF_TIME":    return "live";
    default: return "upcoming";
  }
}

function normalise(m) {
  const ft   = m.score?.fullTime  || {};
  const pens = m.score?.penalties || {};
  return {
    id:                 m.id,
    round:              STAGE_MAP[m.stage] || m.stage || "Group Stage",
    homeTeam:           m.homeTeam?.name || "TBD",
    awayTeam:           m.awayTeam?.name || "TBD",
    homeScore:          ft.home   ?? null,
    awayScore:          ft.away   ?? null,
    status:             normaliseStatus(m.status),
    penaltiesHomeScore: pens.home ?? null,
    penaltiesAwayScore: pens.away ?? null,
    utcDate:            m.utcDate || null,
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const cache    = caches.default;
    const cacheReq = new Request("https://wc2026-fdo-cache.internal/matches");

    // Serve from cache if available
    const cached = await cache.match(cacheReq);
    if (cached) {
      const body = await cached.json();
      return respond(body, { "X-Cache": "HIT" });
    }

    // Cache miss — fetch from football-data.org
    const apiKey = env.FDO_API_KEY;
    if (!apiKey) {
      return respond({ error: "FDO_API_KEY not set in Worker environment variables" }, {}, 500);
    }

    let matches;
    try {
      const upstream = await fetch(UPSTREAM_URL, {
        headers: { "X-Auth-Token": apiKey }
      });
      if (upstream.status === 429) throw new Error("Rate limited by football-data.org");
      if (!upstream.ok)           throw new Error(`Upstream HTTP ${upstream.status}`);
      const data = await upstream.json();
      matches = (data.matches || []).map(normalise);
    } catch (err) {
      return respond({ error: "Upstream fetch failed", detail: err.message }, {}, 502);
    }

    const isLive = matches.some(m => m.status === "live");
    const ttl    = isLive ? TTL_LIVE : TTL_DEFAULT;

    // Store in Cloudflare cache
    ctx.waitUntil(cache.put(
      cacheReq,
      new Response(JSON.stringify(matches), {
        headers: {
          "Content-Type":  "application/json",
          "Cache-Control": `public, max-age=${ttl}`,
        }
      })
    ));

    return respond(matches, { "X-Cache": "MISS", "X-TTL": String(ttl) });
  }
};

function respond(data, extra = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extra }
  });
}
