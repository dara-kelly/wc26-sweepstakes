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
    r32Win: 0,       // Round of 32
    r16Win: 0,       // Round of 16
    qfWin: 0,        // Quarter-final
    sfWin: 0,       // Semi-final
    finalWin: 0,    // Winner
    runnerUp: 0,    // Runner-up bonus
    goalScored: 0,   // Per goal, all rounds
  },

  // PLAYER ASSIGNMENTS — name: [team1, team2, team3]
  // Team names must match the team codes used by the API
  players: {
    "Adrian":   ["Morocco", "Colombia", "Austria", "Ivory Coast", "Bosnia-Herzegovina"],
    "Anna":    ["Argentina", "Uruguay", "Algeria", "Scotland", "Iraq"],
    "Ciaran":   ["England", "United States", "Australia", "Czechia", "South Africa"],
    "Dara":    ["Spain", "Japan", "Egypt", "Congo DR", "Qatar"],
    "Ellen":     ["Netherlands", "Croatia", "Turkey", "Panama", "Cape Verde Islands"],
    "John":      ["Brazil", "Senegal", "Ecuador", "Sweden", "Jordan"],
    "Hannah":     ["Germany", "Belgium", "Iran", "Norway", "Ghana"],
    "Michael":    ["France", "Switzerland", "Canada", "Tunisia", "Uzbekistan"],
    "Ren":     ["Portugal", "Mexico", "South Korea", "Paraguay", "Saudi Arabia"],
  },

  // API config
  api: {
    // Free tier: https://wc2026api.com — 100 req/day
    // Replace with your actual API key
    
  key: "d82b7ddefab142d69ab77712a60605ba",
   // key: "YOUR_API_KEY_HERE",
    baseUrl: "https://wc-26.dazk98.workers.dev/",
    // Poll interval in ms (5 min during live games, managed by app)
    pollInterval: 300000,
  }
};
