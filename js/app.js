// ============================================================ APP.JS — UI rendering, polling loop, tab switching Depends on: config.js, engine.js, api.js ============================================================ ---- State ----
let lastScores = null;       // previous poll's scores, for change calculation
let pollTimer = null;
let matches = [];

const FLAGS = {
  "Argentina": "🇦🇷", "France": "🇫🇷", "Brazil": "🇧🇷", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Germany": "🇩🇪", "Spain": "🇪🇸", "Portugal": "🇵🇹", "Netherlands": "🇳🇱",
  "Belgium": "🇧🇪", "Uruguay": "🇺🇾", "Croatia": "🇭🇷", "Denmark": "🇩🇰",
  "Switzerland": "🇨🇭", "United States": "🇺🇸", "USA": "🇺🇸", "Mexico": "🇲🇽", "Canada": "🇨🇦",
  "Morocco": "🇲🇦", "Senegal": "🇸🇳", "Japan": "🇯🇵", "South Korea": "🇰🇷",
  "Australia": "🇦🇺", "Ecuador": "🇪🇨", "Colombia": "🇨🇴", "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Serbia": "🇷🇸", "Poland": "🇵🇱", "Iran": "🇮🇷", "Saudi Arabia": "🇸🇦",
  "Ghana": "🇬🇭", "Tunisia": "🇹🇳", "Costa Rica": "🇨🇷", "Qatar": "🇶🇦",
  "Cameroon": "🇨🇲", "New Zealand": "🇳🇿", "Ivory Coast": "🇨🇮",
  "Guatemala": "🇬🇹", "Bolivia": "🇧🇴", "Albania": "🇦🇱",
  // Added
  "Paraguay": "🇵🇾", "Uzbekistan": "🇺🇿", "Norway": "🇳🇴", "Sweden": "🇸🇪",
  "Jordan": "🇯🇴", "Panama": "🇵🇦", "Cape Verde Islands": "🇨🇻", "Egypt": "🇪🇬",
  "Congo DR": "🇨🇩", "Czechia": "🇨🇿", "Czech Republic": "🇨🇿",
  "South Africa": "🇿🇦", "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Iraq": "🇮🇶",
  "Bosnia-Herzegovina": "🇧🇦", "Bosnia and Herzegovina": "🇧🇦",
  "Algeria": "🇩🇿", "Austria": "🇦🇹", "Turkey": "🇹🇷 ",
};


function flag(team) {
  return FLAGS[team] || "🏳";
}

// ---- Tab switching ----
function showTab(name, el) {
  ["leaderboard", "fixtures", "rules"].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === name ? "" : "none";
  });
  document.querySelectorAll("nav a").forEach(a => a.classList.remove("active"));
  if (el) el.classList.add("active");
}

// ---- Modal ----
function openModal(playerData) {
  document.getElementById("modal-name").textContent = playerData.player;
  document.getElementById("modal-sub").textContent =
    `Total: ${playerData.total} pts · Teams: ${playerData.teams.map(t => flag(t) + " " + t).join(", ")}`;

  const body = document.getElementById("modal-body");
  if (!playerData.breakdown.length) {
    body.innerHTML = `<p style="color:#555;font-size:13px;padding:12px 0">No points scored yet.</p>`;
  } else {
    // Group by round
    const byRound = {};
    for (const b of playerData.breakdown) {
      if (!byRound[b.round]) byRound[b.round] = [];
      byRound[b.round].push(b);
    }
    body.innerHTML = Object.entries(byRound).map(([round, items]) => `
      <div style="margin-bottom:14px">
        <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:2px;
                    font-family:'Barlow Condensed',sans-serif;font-weight:700;
                    padding-bottom:5px;border-bottom:1px solid #1a1a1a;margin-bottom:6px">
          ${round}
        </div>
        ${items.map(b => `
          <div class="breakdown-item">
            <div>
              <div class="breakdown-match">${flag(b.team)} ${b.team} — ${b.match}</div>
              <div style="font-size:11px;color:#444;margin-top:2px">
                ${b.goals} goal${b.goals !== 1 ? "s" : ""} scored
              </div>
            </div>
            <div style="text-align:right">
              <span class="breakdown-pts">+${b.points}</span>
              ${b.live ? `<span class="breakdown-live">● LIVE</span>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    `).join("");
  }

  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

// ---- Shared: compute eliminated teams from match list ----
function getEliminatedTeams() {
  const eliminated = new Set();
  for (const m of matches) {
    if (m.status !== "completed" && m.status !== "FT") continue;
    if (m.round === "Group Stage") continue;
    const homeGoals = m.homeScore ?? 0;
    const awayGoals = m.awayScore ?? 0;
    const homePens  = m.penaltiesHomeScore ?? 0;
    const awayPens  = m.penaltiesAwayScore ?? 0;
    let loser;
    if (homeGoals !== awayGoals) {
      loser = homeGoals < awayGoals ? m.homeTeam : m.awayTeam;
    } else {
      loser = homePens < awayPens ? m.homeTeam : m.awayTeam;
    }
    if (loser) eliminated.add(loser);
  }
  return eliminated;
}

// ---- Render leaderboard — table rows (desktop) + cards (mobile) ----
function renderLeaderboard(scores, groupsDone) {
  const container    = document.getElementById("leaderboard-rows");
  const rankClass    = ["", "p1", "p2", "p3"];
  const rankNumClass = ["", "r1", "r2", "r3"];
  const cardAccent   = ["", "#c8a600", "#888888", "#cd7f32"];
  const eliminated   = getEliminatedTeams();

  container.innerHTML = scores.map((s, i) => {
    const rank  = i + 1;
    const prev  = lastScores ? lastScores.find(p => p.player === s.player) : null;
    const delta = prev != null ? s.total - prev.total : null;

    const changeHtml = delta === null ? "" :
      delta > 0 ? `<span class="pts-change up">▲ +${delta}</span>` :
      delta < 0 ? `<span class="pts-change dn">▼ ${delta}</span>` :
                  `<span class="pts-change zero">— 0</span>`;

    const cardChangeHtml = delta === null ? "" :
      delta > 0 ? `<div class="card-change up">▲ +${delta}</div>` :
      delta < 0 ? `<div class="card-change dn">▼ ${delta}</div>` :
                  `<div class="card-change zero">—</div>`;

    const teamPills = s.teams.map(t => {
      const cls = eliminated.has(t) ? "team-pill elim" : "team-pill active";
      return `<span class="${cls}">${flag(t)} ${t}</span>`;
    }).join("");

    const wcWinner = s.ownsTournamentWinner
      ? `<span style="margin-left:4px;font-size:12px" title="Owns the WC winner">🏆</span>` : "";

    const modalData = JSON.stringify(s).replace(/"/g, '&quot;');
    const accentColor = cardAccent[rank] || "var(--border)";

    const tableRow = `
      <div class="lb-row ${rankClass[rank] || ""}" onclick="openModal(${modalData})">
        <span class="rank ${rankNumClass[rank] || ""}">${rank}</span>
        <div>
          <div class="player-name">${s.player}${wcWinner}</div>
          <div class="player-teams">${teamPills}</div>
        </div>
        <div class="pts-total">${s.total}<br><small>pts</small></div>
        <div>${changeHtml}</div>
        <div>${s.prize
          ? `<div class="prize-val" title="${s.prizeLabel || ""}">${s.prize}</div>`
          : `<div class="prize-val none">—</div>`}
        </div>
      </div>`;

    const card = `
      <div class="lb-row-card" style="border-left-color:${accentColor}" onclick="openModal(${modalData})">
        <div class="card-top">
          <div class="card-rank ${rankNumClass[rank] || ""}">${rank}</div>
          <div class="card-player">
            <div class="card-name">${s.player}${wcWinner}</div>
            ${s.prize ? `<div class="card-prize">${s.prize} — ${s.prizeLabel}</div>` : ""}
          </div>
          <div class="card-pts-block">
            <div class="card-pts">${s.total}</div>
            <div class="card-pts-label">pts</div>
            ${cardChangeHtml}
          </div>
        </div>
        <div class="card-bottom">${teamPills}</div>
      </div>`;

    return tableRow + card;
  }).join("");
}

// ---- Render live games strip ----
function renderLiveGames(liveMatches) {
  const section = document.getElementById("live-section");
  const container = document.getElementById("live-games");
  if (!liveMatches.length) { section.style.display = "none"; return; }
  section.style.display = "";
  container.innerHTML = liveMatches.map(m => `
    <div class="game-card live">
      <div class="game-time live-t">LIVE</div>
      <div class="game-body">
        <div class="game-team home ${(m.homeScore ?? 0) > (m.awayScore ?? 0) ? "winner" : ""}">
          ${flag(m.homeTeam)} ${m.homeTeam}
        </div>
        <div class="game-score live">${m.homeScore ?? 0} – ${m.awayScore ?? 0}</div>
        <div class="game-team away ${(m.awayScore ?? 0) > (m.homeScore ?? 0) ? "winner" : ""}">
          ${flag(m.awayTeam)} ${m.awayTeam}
        </div>
      </div>
      <div class="game-meta">
        <div class="live-dot">● LIVE</div>
        <div class="pts-tag">+pts</div>
      </div>
    </div>
  `).join("");
}

// ---- Render all fixtures tab ----
function renderFixtures(allMatches) {
  const container = document.getElementById("all-fixtures");
  const rounds = {};
  for (const m of allMatches) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }
  const roundOrder = ["Group Stage","Round of 32","Round of 16","Quarter-final","Semi-final","Final"];
  const sorted = roundOrder.filter(r => rounds[r]).map(r => [r, rounds[r]]);
  // Append any unexpected rounds at the end
  for (const r of Object.keys(rounds)) {
    if (!roundOrder.includes(r)) sorted.push([r, rounds[r]]);
  }

  container.innerHTML = sorted.map(([round, ms]) => `
    <div style="margin-bottom:20px">
      <div class="section-hd">
        <span class="section-title" style="font-size:14px">${round}</span>
      </div>
      ${ms.map(m => {
        const isLive = ["live","1H","2H","HT"].includes(m.status);
        const isDone = m.status === "completed" || m.status === "FT";
        const isUp = m.status === "upcoming" || m.status === "NS" || m.homeScore === null;
        return `
          <div class="game-card ${isLive ? "live" : ""}">
            <div class="game-time ${isLive ? "live-t" : ""}">${isLive ? "LIVE" : isDone ? "FT" : "—"}</div>
            <div class="game-body">
              <div class="game-team home ${isDone && (m.homeScore > m.awayScore) ? "winner" : ""}">
                ${flag(m.homeTeam)} ${m.homeTeam}
              </div>
              ${isUp
                ? `<div class="game-score upcoming">vs</div>`
                : `<div class="game-score ${isLive ? "live" : ""}">${m.homeScore} – ${m.awayScore}</div>`
              }
              <div class="game-team away ${isDone && (m.awayScore > m.homeScore) ? "winner" : ""}">
                ${flag(m.awayTeam)} ${m.awayTeam}
              </div>
            </div>
            <div class="game-meta">
              ${isLive ? `<div class="live-dot">● LIVE</div>` : ""}
              ${isDone && m.penaltiesHomeScore != null
                ? `<div style="font-size:10px;color:#555">Pens: ${m.penaltiesHomeScore}–${m.penaltiesAwayScore}</div>`
                : ""}
            </div>
          </div>`;
      }).join("")}
    </div>
  `).join("");
}

// ---- Render rules tab ----
function renderRules() {
  const rules = [
    [3,  "Group stage win"],
    [1,  "Group stage draw"],
    [0,  "Group stage loss"],
    ["+2", "Qualified from group stage (per team)"],
    ["🏆", "Own the World Cup winner"],
  ];
  document.getElementById("rules-grid").innerHTML = rules.map(([p, d]) => `
    <div class="rule-item">
      <span class="rule-pts" style="font-size:${typeof p === 'string' ? '14px' : '20px'}">${typeof p === 'number' ? '+' + p : p}</span>
      <span class="rule-desc">${d}</span>
    </div>
  `).join("");

  // Player assignments table
  const players = CONFIG.players;
  document.getElementById("assignments-table").innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="border-bottom:1px solid #222">
          <th style="text-align:left;padding:6px 8px;color:#555;font-size:10px;
                     text-transform:uppercase;letter-spacing:1px;font-family:'Barlow Condensed',sans-serif">Player</th>
          <th style="text-align:left;padding:6px 8px;color:#555;font-size:10px;
                     text-transform:uppercase;letter-spacing:1px;font-family:'Barlow Condensed',sans-serif">Teams</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(players).map(([name, teams]) => `
          <tr style="border-bottom:1px solid #161616">
            <td style="padding:8px;color:#ccc;font-weight:600">${name}</td>
            <td style="padding:8px">
              ${teams.map(t => `<span class="team-pill active" style="margin-right:4px">${flag(t)} ${t}</span>`).join("")}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ---- Render sidebar ----
function renderSidebar(allMatches) {
  const allTeams = new Set(Object.values(CONFIG.players).flat());
  const eliminatedTeams = getEliminatedTeams();

  const remaining = [...allTeams].filter(t => !eliminatedTeams.has(t));
  const elim = [...allTeams].filter(t => eliminatedTeams.has(t));

  document.getElementById("sidebar-teams").innerHTML = remaining.map(t => `
    <div class="team-row">
      <span class="team-row-name">${flag(t)} ${t}</span>
    </div>
  `).join("") || `<div style="font-size:12px;color:#333;padding:4px">None yet</div>`;

  document.getElementById("sidebar-elim").innerHTML = elim.map(t => `
    <div class="team-row elim">
      <span class="team-row-name">${flag(t)} ${t}</span>
      <span class="team-row-pts">OUT</span>
    </div>
  `).join("") || `<div style="font-size:12px;color:#333;padding:4px">None yet</div>`;
}

// ---- Render right rail ----
function renderRail(scores, allMatches) {
  // Hot streak: player with most points in last 3 completed matches
  if (scores.length > 0) {
    const leader = scores[0];
    const box = document.getElementById("hot-streak-box");
    document.getElementById("hot-streak-text").textContent =
      `${leader.player} leads with ${leader.total} pts from ${leader.teams.map(t => flag(t)).join(" ")}`;
    box.style.display = "";
  }

  // Next upcoming fixtures
  const upcoming = allMatches.filter(m => m.status === "upcoming" || m.status === "NS" || m.homeScore === null);
  const rail = document.getElementById("next-fixtures-rail");
  if (!upcoming.length) {
    rail.textContent = "No upcoming fixtures";
  } else {
    rail.innerHTML = upcoming.slice(0, 4).map(m =>
      `<div>${flag(m.homeTeam)} ${m.homeTeam} <span style="color:#333">v</span> ${flag(m.awayTeam)} ${m.awayTeam}</div>`
    ).join("");
  }
}

// ---- Render header / hero ----
function renderMeta(allMatches, scores, pot, groupsDone, tournamentWinner) {
  const playerCount = Object.keys(CONFIG.players).length;
  const liveMatches = allMatches.filter(m => ["live","1H","2H","HT"].includes(m.status));
  const played = allMatches.filter(m => m.status === "completed" || m.status === "FT").length;
  const currentRound = (() => {
    const roundOrder = ["Final","Semi-final","Quarter-final","Round of 16","Round of 32","Group Stage"];
    for (const r of roundOrder) {
      if (allMatches.some(m => m.round === r && (m.status === "completed" || m.status === "FT" || ["live","1H","2H","HT"].includes(m.status)))) {
        return r;
      }
    }
    return "Group Stage";
  })();

  document.getElementById("badge-players").textContent = `${playerCount} Players`;
  document.getElementById("badge-round").textContent = currentRound;
  document.getElementById("pot-amount").textContent = `${CONFIG.currency}${pot*1000}`;
  document.getElementById("stat-players").textContent = playerCount;
  document.getElementById("stat-played").textContent = played;

  if (liveMatches.length) {
    document.getElementById("badge-live").style.display = "";
    document.getElementById("stat-live").style.display = "";
    document.getElementById("stat-live-lbl").style.display = "";
    document.getElementById("stat-live").textContent = liveMatches.length;
  } else {
    document.getElementById("badge-live").style.display = "none";
    document.getElementById("stat-live").style.display = "none";
    document.getElementById("stat-live-lbl").style.display = "none";
  }

  // Prize strip
  const { prizes, currency } = CONFIG;
  const wcWinnerName = tournamentWinner || "WC Winner";
  document.getElementById("prize-strip").innerHTML = `
    <span class="prize-item">🥇 Group winner: <strong>${currency}${Math.round(pot * prizes.groupWinner)}</strong></span>
    <span class="prize-item">🏆 Owns ${wcWinnerName}: <strong>${currency}${Math.round(pot * prizes.tournamentWinner)}</strong></span>
    <span class="prize-item">🥄 Last place: <strong>${currency}${Math.round(pot * prizes.lastPlace)}</strong></span>
    <span class="prize-item">Webmaster: <strong>${currency}${89910}</strong></span>
  `;

  // Timestamp
  const now = new Date();
  document.getElementById("updated-at").textContent =
    `Updated ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

// ---- Ticker ----
function renderTicker(allMatches, scores) {
  const liveMatches = allMatches.filter(m => ["live","1H","2H","HT"].includes(m.status));
  const parts = [`⚽ ${CONFIG.name}`];
  if (liveMatches.length) {
    liveMatches.forEach(m => {
      parts.push(`🔴 LIVE: ${flag(m.homeTeam)} ${m.homeTeam} ${m.homeScore}–${m.awayScore} ${flag(m.awayTeam)} ${m.awayTeam}`);
    });
  }
  if (scores.length > 0) {
    parts.push(`🏆 Leader: ${scores[0].player} — ${scores[0].total} pts`);
  }
  parts.push(`💰 Prize pool: ${CONFIG.currency}${Object.keys(CONFIG.players).length * CONFIG.entryFee}`);
  document.getElementById("ticker-text").textContent = parts.join("  •  ");
}

// ---- Main poll cycle ----
async function poll() {
  try {
    matches = await API.fetchMatches();
    const calcResult = ScoreEngine.calculate(matches, CONFIG);
    const { scores, pot, groupsDone, tournamentWinner } = ScoreEngine.computePrizes(calcResult, CONFIG);

    const liveMatches = matches.filter(m => ["live","1H","2H","HT"].includes(m.status));

    renderMeta(matches, scores, pot, groupsDone, tournamentWinner);
    renderLeaderboard(scores, groupsDone);
    renderLiveGames(liveMatches);
    renderFixtures(matches);
    renderSidebar(matches);
    renderRail(scores, matches);
    renderTicker(matches, scores);

    lastScores = scores.map(s => ({ player: s.player, total: s.total }));

    // Schedule next poll — faster if live games are on
    clearTimeout(pollTimer);
    const interval = liveMatches.length ? 60_000 : CONFIG.api.pollInterval;
    pollTimer = setTimeout(poll, interval);

  } catch (err) {
    console.error("[App] Poll error:", err);
    document.getElementById("leaderboard-rows").innerHTML = `
      <div class="loading-screen">
        <div style="color:#d9534f;font-size:13px;font-family:'Barlow Condensed',sans-serif;
                    text-transform:uppercase;letter-spacing:1px">
          ⚠ Failed to load scores — retrying in 60s
        </div>
      </div>`;
    pollTimer = setTimeout(poll, 60_000);
  }
}

// ---- Boot ----
document.addEventListener("DOMContentLoaded", () => {
  renderRules();   // rules tab is static, render once
  poll();          // initial data load
});
