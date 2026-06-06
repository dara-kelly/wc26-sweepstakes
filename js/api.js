// ============================================================
// API FETCHER
// Primary:  football-data.org v4 (free tier, requires key)
//           GET https://api.football-data.org/v4/competitions/WC/matches
//           Header: X-Auth-Token: YOUR_KEY
// Fallback: openfootball/worldcup.json (no key, community-updated)
//           Results may lag by minutes–hours after a match ends.
//
// Both sources are normalised to the same internal match shape:
// {
//   id, round, homeTeam, awayTeam,
//   homeScore, awayScore,       -- null if not yet played
//   status,                     -- "completed" | "live" | "upcoming"
//   penaltiesHomeScore,         -- null if no penalties
//   penaltiesAwayScore,
// }
// ============================================================

const API = (() => {

  // ---- football-data.org stage → our round label ----
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

  // football-data.org status → our status
  function normaliseStatus(s) {
    if (!s) return "upcoming";
    switch (s.toUpperCase()) {
      case "FINISHED":
      case "FT":
      case "AET":
      case "PEN":        return "completed";
      case "IN_PLAY":
      case "PAUSED":
      case "HALF_TIME":
      case "1H": case "2H": case "HT":
      case "LIVE":       return "live";
      default:           return "upcoming";
    }
  }

  // ---- Normalise a football-data.org v4 match object ----
  function normaliseFDO(m) {
    const score = m.score || {};
    const ft    = score.fullTime   || {};
    const pens  = score.penalties  || {};

    // fullTime scores are null until the match starts
    const homeScore = ft.home  ?? null;
    const awayScore = ft.away  ?? null;

    return {
      id:                 m.id,
      round:              STAGE_MAP[m.stage] || m.stage || "Group Stage",
      homeTeam:           m.homeTeam?.name   || "TBD",
      awayTeam:           m.awayTeam?.name   || "TBD",
      homeScore,
      awayScore,
      status:             normaliseStatus(m.status),
      penaltiesHomeScore: pens.home ?? null,
      penaltiesAwayScore: pens.away ?? null,
      utcDate:            m.utcDate || null,
    };
  }

  // ---- Normalise an openfootball match object ----
  // Schema: { team1, team2, score: { ft: [h,a] }, round, group, date }
  // Round values in openfootball for WC 2026:
  //   "Matchday 1/2/3" → Group Stage
  //   "Round of 32", "Round of 16", "Quarter-finals",
  //   "Semi-finals", "Final"
  function normaliseOpenfootball(m, idx) {
    const roundRaw = m.round || "";
    let round = "Group Stage";
    if (/matchday/i.test(roundRaw))               round = "Group Stage";
    else if (/32/i.test(roundRaw))                round = "Round of 32";
    else if (/16|last 16/i.test(roundRaw))        round = "Round of 16";
    else if (/quarter/i.test(roundRaw))           round = "Quarter-final";
    else if (/semi/i.test(roundRaw))              round = "Semi-final";
    else if (/final/i.test(roundRaw) && !/semi/i.test(roundRaw)) round = "Final";

    const ft         = m.score?.ft;
    const hasScore   = Array.isArray(ft) && ft.length === 2;
    const homeScore  = hasScore ? ft[0] : null;
    const awayScore  = hasScore ? ft[1] : null;
    const status     = hasScore ? "completed" : "upcoming";

    // Openfootball has no live data — a match with no score is upcoming
    return {
      id:                 idx,
      round,
      homeTeam:           m.team1 || "TBD",
      awayTeam:           m.team2 || "TBD",
      homeScore,
      awayScore,
      status,
      penaltiesHomeScore: null,
      penaltiesAwayScore: null,
      utcDate:            m.date  || null,
    };
  }

  // ---- Fetch from football-data.org ----
  async function fetchFromFDO(key) {
    const url = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
    const res = await fetch(url, {
      headers: { "X-Auth-Token": key }
    });
    if (res.status === 429) throw new Error("Rate limited by football-data.org");
    if (!res.ok)            throw new Error(`football-data.org returned HTTP ${res.status}`);
    const data = await res.json();
    const matches = data.matches || [];
    return matches.map(normaliseFDO);
  }

  // ---- Fetch from openfootball (no key, community-updated) ----
  async function fetchFromOpenfootball() {
    const url = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`openfootball fetch failed: HTTP ${res.status}`);
    const data = await res.json();
    const matches = data.matches || [];
    return matches.map(normaliseFDO);
  }

  // ---- Mock data for development (no key needed) ----
  const MOCK_MATCHES = [
    // Group Stage
    { id:1,  round:"Group Stage", homeTeam:"Argentina",   awayTeam:"Bolivia",      homeScore:3, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:2,  round:"Group Stage", homeTeam:"France",      awayTeam:"Denmark",      homeScore:2, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:3,  round:"Group Stage", homeTeam:"Brazil",      awayTeam:"Serbia",       homeScore:4, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:4,  round:"Group Stage", homeTeam:"England",     awayTeam:"Iran",         homeScore:0, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:5,  round:"Group Stage", homeTeam:"Germany",     awayTeam:"Japan",        homeScore:1, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:6,  round:"Group Stage", homeTeam:"Spain",       awayTeam:"Costa Rica",   homeScore:7, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:7,  round:"Group Stage", homeTeam:"Netherlands", awayTeam:"Senegal",      homeScore:2, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:8,  round:"Group Stage", homeTeam:"Portugal",    awayTeam:"Ghana",        homeScore:2, awayScore:3, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:9,  round:"Group Stage", homeTeam:"Argentina",   awayTeam:"Mexico",       homeScore:2, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:10, round:"Group Stage", homeTeam:"France",      awayTeam:"Australia",    homeScore:4, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:11, round:"Group Stage", homeTeam:"Brazil",      awayTeam:"Switzerland",  homeScore:1, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:12, round:"Group Stage", homeTeam:"England",     awayTeam:"United States",homeScore:0, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:13, round:"Group Stage", homeTeam:"Spain",       awayTeam:"Germany",      homeScore:1, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:14, round:"Group Stage", homeTeam:"Morocco",     awayTeam:"Croatia",      homeScore:0, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:15, round:"Group Stage", homeTeam:"Argentina",   awayTeam:"Poland",       homeScore:2, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:16, round:"Group Stage", homeTeam:"France",      awayTeam:"Tunisia",      homeScore:1, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:17, round:"Group Stage", homeTeam:"Brazil",      awayTeam:"Cameroon",     homeScore:1, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:18, round:"Group Stage", homeTeam:"England",     awayTeam:"Wales",        homeScore:3, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:19, round:"Group Stage", homeTeam:"Spain",       awayTeam:"Japan",        homeScore:0, awayScore:2, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:20, round:"Group Stage", homeTeam:"Germany",     awayTeam:"Costa Rica",   homeScore:4, awayScore:2, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:21, round:"Group Stage", homeTeam:"Germany",     awayTeam:"Costa Rica",   homeScore:4, awayScore:2, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:22, round:"Group Stage", homeTeam:"Germany",     awayTeam:"Costa Rica",   homeScore:4, awayScore:2, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:23, round:"Group Stage", homeTeam:"Germany",     awayTeam:"Costa Rica",   homeScore:4, awayScore:2, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    // Round of 32
    { id:30, round:"Round of 32", homeTeam:"Argentina",   awayTeam:"Australia",    homeScore:2, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:31, round:"Round of 32", homeTeam:"France",      awayTeam:"Poland",       homeScore:3, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:32, round:"Round of 32", homeTeam:"Brazil",      awayTeam:"South Korea",  homeScore:4, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:33, round:"Round of 32", homeTeam:"England",     awayTeam:"Senegal",      homeScore:3, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:34, round:"Round of 32", homeTeam:"Netherlands", awayTeam:"United States",homeScore:3, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:35, round:"Round of 32", homeTeam:"Spain",       awayTeam:"Morocco",      homeScore:0, awayScore:0, status:"completed", penaltiesHomeScore:3,    penaltiesAwayScore:0    },
    { id:36, round:"Round of 32", homeTeam:"Germany",     awayTeam:"Japan",        homeScore:1, awayScore:0, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:37, round:"Round of 32", homeTeam:"Portugal",    awayTeam:"Switzerland",  homeScore:6, awayScore:1, status:"completed", penaltiesHomeScore:null, penaltiesAwayScore:null },
    // Round of 16 — two live, two upcoming
    { id:40, round:"Round of 16", homeTeam:"Argentina",   awayTeam:"France",       homeScore:2, awayScore:1, status:"live",      penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:41, round:"Round of 16", homeTeam:"Brazil",      awayTeam:"England",      homeScore:1, awayScore:0, status:"live",      penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:42, round:"Round of 16", homeTeam:"Germany",     awayTeam:"Spain",        homeScore:null, awayScore:null, status:"upcoming", penaltiesHomeScore:null, penaltiesAwayScore:null },
    { id:43, round:"Round of 16", homeTeam:"Netherlands", awayTeam:"Portugal",     homeScore:null, awayScore:null, status:"upcoming", penaltiesHomeScore:null, penaltiesAwayScore:null },
  ];

  // ---- Main fetch function ----
  async function fetchMatches() {
    const { key, baseUrl } = CONFIG.api;
    const useMock = !key || key === "YOUR_API_KEY_HERE";

    // 1. Mock mode
    if (useMock) {
      console.info("[API] No key set — using mock data");
      return MOCK_MATCHES;
    }

    // 2. Cloudflare Worker proxy (if baseUrl overridden to worker URL)
    const isWorker = baseUrl && !baseUrl.includes("football-data.org") && !baseUrl.includes("raw.githubusercontent");
    if (isWorker) {
      try {
        console.info("[API] Fetching via Cloudflare Worker proxy");
        const res = await fetch(`${baseUrl}/matches`);
        if (!res.ok) throw new Error(`Worker returned HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn("[API] Worker fetch failed, falling back:", err.message);
      }
    }

    // 3. football-data.org directly
    try {
      console.info("[API] Fetching from football-data.org");
      return await fetchFromFDO(key);
    } catch (err) {
      console.warn("[API] football-data.org failed:", err.message, "— trying openfootball fallback");
    }

    // 4. openfootball fallback (no live scores, but completed results)
    try {
      console.info("[API] Fetching from openfootball (no live scores)");
      return await fetchFromOpenfootball();
    } catch (err) {
      console.warn("[API] openfootball failed:", err.message, "— using mock data");
    }

    // 5. Last resort: mock
    return MOCK_MATCHES;
  }

  function hasLiveGames(matches) {
    return matches.some(m => m.status === "live");
  }

  return { fetchMatches, hasLiveGames, MOCK_MATCHES };
})();
