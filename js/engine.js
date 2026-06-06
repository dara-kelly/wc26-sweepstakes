// ============================================================
// SCORE ENGINE — calculates player points from match results
//
// SCORING RULES:
//   Group stage (per game):  Win = 3pts, Draw = 1pt, Loss = 0pts
//   Qualified from groups:   +2 bonus per team that makes it through
//   Knockout stage:          No per-game points
//   Prizes:
//     - Group stage winner   (most points after all group games done)
//     - Group stage last     (fewest points after all group games done)
//     - World Cup winner     (player who owns the tournament winner)
// ============================================================

const ScoreEngine = (() => {

  const KNOCKOUT_ROUNDS = new Set(["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Final"]);
  const GROUP_ROUND = "Group Stage";

  // Build reverse lookup: team (lowercase) -> [player names]
  function buildTeamOwners(players) {
    const owners = {};
    for (const [player, teams] of Object.entries(players)) {
      for (const team of teams) {
        const key = team.toLowerCase();
        if (!owners[key]) owners[key] = [];
        owners[key].push(player);
      }
    }
    return owners;
  }

  // Determine which teams have qualified from the group stage.
  // A team has qualified if it appears in any knockout round match.
  function getQualifiedTeams(matches) {
    const qualified = new Set();
    for (const m of matches) {
      if (KNOCKOUT_ROUNDS.has(m.round)) {
        qualified.add(m.homeTeam.toLowerCase());
        qualified.add(m.awayTeam.toLowerCase());
      }
    }
    return qualified;
  }

  // Determine the World Cup winner:
  // The team that won the Final (completed).
  function getTournamentWinner(matches) {
    const final = matches.find(m => m.round === "Final" && (m.status === "completed" || m.status === "FT"));
    if (!final) return null;
    const homeGoals = final.homeScore ?? 0;
    const awayGoals = final.awayScore ?? 0;
    if (homeGoals > awayGoals) return final.homeTeam;
    if (awayGoals > homeGoals) return final.awayTeam;
    // Went to penalties
    if (final.penaltiesHomeScore != null) {
      return final.penaltiesHomeScore > final.penaltiesAwayScore ? final.homeTeam : final.awayTeam;
    }
    return null;
  }

  // Are all group stage games finished?
  function groupStageComplete(matches) {
    const groupMatches = matches.filter(m => m.round === GROUP_ROUND);
    return groupMatches.length > 0 &&
      groupMatches.every(m => m.status === "completed" || m.status === "FT");
  }

  // Main calculation
  function calculate(matches, config) {
    const { players } = config;
    const owners = buildTeamOwners(players);
    const qualified = getQualifiedTeams(matches);
    const groupsDone = groupStageComplete(matches);
    const tournamentWinner = getTournamentWinner(matches);

    // Initialise player scores
    const scores = {};
    for (const player of Object.keys(players)) {
      scores[player] = {
        player,
        total: 0,
        groupPoints: 0,
        qualificationBonus: 0,
        breakdown: [],
        teams: players[player],
        ownsTournamentWinner: false,
      };
    }

    // --- Group stage points ---
    const groupMatches = matches.filter(
      m => m.round === GROUP_ROUND && (m.status === "completed" || m.status === "FT" || m.status === "live" || m.status === "1H" || m.status === "2H" || m.status === "HT")
    );

    for (const m of groupMatches) {
      const isLive = ["live","1H","2H","HT"].includes(m.status);
      const homeGoals = m.homeScore ?? 0;
      const awayGoals = m.awayScore ?? 0;

      for (const [teamName, isHome] of [[m.homeTeam, true], [m.awayTeam, false]]) {
        const myGoals = isHome ? homeGoals : awayGoals;
        const theirGoals = isHome ? awayGoals : homeGoals;

        let pts = 0;
        if (myGoals > theirGoals) pts = 3;
        else if (myGoals === theirGoals) pts = 1;
        else pts = 0;

        const teamOwners = owners[teamName.toLowerCase()] || [];
        for (const player of teamOwners) {
          if (pts > 0) {
            scores[player].groupPoints += pts;
            scores[player].total += pts;
            scores[player].breakdown.push({
              type: "group",
              match: `${m.homeTeam} v ${m.awayTeam}`,
              team: teamName,
              points: pts,
              result: myGoals > theirGoals ? "W" : myGoals === theirGoals ? "D" : "L",
              score: `${m.homeScore}–${m.awayScore}`,
              live: isLive,
            });
          }
        }
      }
    }

    // --- Qualification bonus (+2 per team that made it through groups) ---
    // Only awarded once group stage is complete
    if (groupsDone) {
      for (const [player, teams] of Object.entries(players)) {
        for (const team of teams) {
          if (qualified.has(team.toLowerCase())) {
            scores[player].qualificationBonus += 2;
            scores[player].total += 2;
            scores[player].breakdown.push({
              type: "qualification",
              team,
              points: 2,
              match: "Qualified from Group Stage",
              live: false,
            });
          }
        }
      }
    }

    // --- Tournament winner flag ---
    if (tournamentWinner) {
      const winnerOwners = owners[tournamentWinner.toLowerCase()] || [];
      for (const player of winnerOwners) {
        scores[player].ownsTournamentWinner = true;
      }
    }

    // Sort by total group+qualification points desc
    const sorted = Object.values(scores).sort((a, b) => b.total - a.total);
    return { scores: sorted, qualified, groupsDone, tournamentWinner };
  }

  // Assign prizes
  function computePrizes(calcResult, config) {
    const { scores, groupsDone, tournamentWinner } = calcResult;
    const { entryFee, currency, prizes } = config;
    const pot = Object.keys(config.players).length * entryFee;

    // Clear any previous prizes
    for (const s of scores) {
      s.prize = null;
      s.prizeLabel = null;
    }

    // 1st place: most group stage points (awarded once groups complete)
    if (groupsDone && scores.length > 0) {
      scores[0].prize = `${currency}${Math.round(pot * prizes.groupWinner)}`;
      scores[0].prizeLabel = "Group stage winner";
    }

    // Last place: fewest points (awarded once groups complete)
    if (groupsDone && scores.length > 1) {
      const last = scores[scores.length - 1];
      last.prize = `${currency}${Math.round(pot * prizes.lastPlace)}`;
      last.prizeLabel = "Last place 🥄";
    }

    // World Cup winner: player who owns the winning team
    if (tournamentWinner) {
      for (const s of scores) {
        if (s.ownsTournamentWinner) {
          s.prize = (s.prize ? s.prize + " + " : "") + `${currency}${Math.round(pot * prizes.tournamentWinner)}`;
          s.prizeLabel = (s.prizeLabel ? s.prizeLabel + " + " : "") + `Owns ${tournamentWinner} 🏆`;
        }
      }
    }

    return { scores, pot, groupsDone, tournamentWinner };
  }

  return { calculate, computePrizes, buildTeamOwners };
})();
