// ============================================================
// SWEEPSTAKES CONFIG — edit this file to set up your draw
// ============================================================

const CONFIG = {
  name: "World Cup 2026 Queepferstakestu",
  currency: "€",
  entryFee: 10,
  prizes: { groupWinner: 0.4, lastPlace: 0.1, tournamentWinner: 0.5 }, // % of pot

  // Points awarded per outcome
  points: {
    groupWin: 3,
    groupDraw: 1,
    groupLoss: 0,
    r32Win: 4,       // Round of 32
    r16Win: 5,       // Round of 16
    qfWin: 8,        // Quarter-final
    sfWin: 12,       // Semi-final
    finalWin: 20,    // Winner
    runnerUp: 10,    // Runner-up bonus
    goalScored: 0,   // Per goal, all rounds
  },

  // PLAYER ASSIGNMENTS — name: [team1, team2, team3]
  // Team names must match the team codes used by the API
  players: {
    "Adrian":   ["South Korea", "Australia", "Mexico"],
    "Anna":    ["Argentina", "Brazil", "United States"],
    "Ciaran":   ["France", "Portugal", "Japan"],
    "Dara":    ["England", "Germany", "Canada"],
    "Ellen":     ["Spain", "Morocco", "Senegal"],
    "John":      ["Uruguay", "Colombia", "Wales"],
    "Hannah":     ["Netherlands", "Belgium", "Switzerland"],
    "Michael":    ["Ecuador", "Cameroon", "Qatar"],
    "Ren":     ["Croatia", "Denmark", "Serbia"],
  },

  // API config
  api: {
    // Free tier: https://wc2026api.com — 100 req/day
    // Replace with your actual API key
//    key: "d82b7ddefab142d69ab77712a60605ba",
    key: "YOUR_API_KEY_HERE",
    baseUrl: "",
    // Poll interval in ms (5 min during live games, managed by app)
    pollInterval: 300000,
  }
};
