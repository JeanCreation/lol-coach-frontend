import { useState, useEffect, useRef, useCallback } from "react";

// ══════════════════════════════════════════════════
// LOL COACH PRO — FULL APP (CONNECTED TO BACKEND)
// ══════════════════════════════════════════════════

const API_BASE = "https://lol-coach-pro-production.up.railway.app/api";

// ── API CALLS ──────────────────────────────────
async function apiCall(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

// ── PERSISTENT STORAGE ─────────────────────────
async function loadStorage(key, shared = false) {
  try {
    const r = await window.storage.get(key, shared);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function saveStorage(key, value, shared = false) {
  try { await window.storage.set(key, JSON.stringify(value), shared); } catch {}
}

// ── HELPERS ────────────────────────────────────
function getEnemyDamageProfile(enemies) {
  let ad = 0, ap = 0, tank = 0;
  enemies.forEach(e => {
    const tags = e.champion?.tags || [];
    if (tags.includes("Assassin") || tags.includes("Marksman") || tags.includes("Fighter")) ad++;
    else if (tags.includes("Mage")) ap++;
    else if (tags.includes("Tank")) tank++;
    else ad++;
  });
  return { ad, ap, tank };
}

function scoreItemVsComp(item, profile) {
  const tags = item.tags || [];
  const name = (item.name || "").toLowerCase();
  const { ad, ap } = profile;
  const apHeavy = ap >= 3;
  const adHeavy = ad >= 3;
  if ((name.includes("force of nature") || name.includes("wit") || name.includes("malmortius") || tags.includes("SpellBlock")) && apHeavy) return { score: 9, reason: `Excellent vs ${ap} AP` };
  if ((name.includes("force of nature") || name.includes("wit") || tags.includes("SpellBlock")) && ap <= 1) return { score: 3, reason: `Inutile — seulement ${ap} AP` };
  if ((name.includes("randuin") || name.includes("thornmail") || name.includes("frozen") || tags.includes("Armor")) && adHeavy) return { score: 9, reason: `Excellent vs ${ad} AD` };
  if (tags.includes("Armor") && ad <= 1) return { score: 3, reason: `Inutile — seulement ${ad} AD` };
  if (tags.includes("Damage")) return { score: 7, reason: "Item offensif standard" };
  if (tags.includes("SpellDamage")) return { score: 7, reason: "Item AP standard" };
  if (tags.includes("Health")) return { score: 6, reason: "Item défensif polyvalent" };
  return { score: 5, reason: "Item situationnel" };
}

const RANKS = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"];

// ── STYLES ──────────────────────────────────────
const S = {
  app: { fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace", background: "#0a0e17", color: "#c8d6e5", minHeight: "100vh", position: "relative", overflow: "hidden" },
  bgGlow: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 60% 40% at 20% 10%, rgba(0,194,255,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 80% 80%, rgba(255,170,0,0.04) 0%, transparent 70%)" },
  container: { position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 16px" },
  header: { padding: "28px 0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderBottom: "1px solid rgba(0,194,255,0.12)" },
  logo: { display: "flex", alignItems: "center", gap: 12 },
  logoIcon: { width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg, #00c2ff 0%, #0066ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", boxShadow: "0 0 20px rgba(0,194,255,0.3)" },
  logoText: { fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" },
  logoSub: { fontSize: 11, color: "#5a7a9a", fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase" },
  premiumBadge: { padding: "6px 14px", borderRadius: 20, background: "linear-gradient(135deg, #ff9500 0%, #ff5e00 100%)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1px", cursor: "pointer", border: "none", textTransform: "uppercase", boxShadow: "0 0 15px rgba(255,149,0,0.3)" },
  nav: { display: "flex", gap: 4, padding: "16px 0 0", flexWrap: "wrap" },
  navBtn: (a) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, letterSpacing: "0.5px", background: a ? "rgba(0,194,255,0.15)" : "transparent", color: a ? "#00c2ff" : "#5a7a9a", borderBottom: a ? "2px solid #00c2ff" : "2px solid transparent", transition: "all 0.2s" }),
  card: { background: "rgba(15,22,36,0.85)", border: "1px solid rgba(0,194,255,0.08)", borderRadius: 14, padding: 24, marginTop: 20, backdropFilter: "blur(10px)" },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  input: { background: "rgba(0,10,20,0.6)", border: "1px solid rgba(0,194,255,0.15)", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  btn: (c = "#00c2ff") => ({ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${c} 0%, ${c}cc 100%)`, color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "0.5px", boxShadow: `0 0 15px ${c}33`, transition: "all 0.2s" }),
  btnSm: (c = "#00c2ff", a = false) => ({ padding: "5px 12px", borderRadius: 6, border: `1px solid ${a ? c : "rgba(255,255,255,0.1)"}`, cursor: "pointer", fontSize: 11, fontWeight: 600, background: a ? `${c}22` : "transparent", color: a ? c : "#5a7a9a", transition: "all 0.2s" }),
  tag: (c) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 12, background: `${c}18`, color: c, fontSize: 11, fontWeight: 600 }),
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  statBox: { background: "rgba(0,10,20,0.5)", borderRadius: 10, padding: 16, textAlign: "center", border: "1px solid rgba(0,194,255,0.06)" },
  statVal: { fontSize: 28, fontWeight: 800, color: "#fff" },
  statLabel: { fontSize: 11, color: "#5a7a9a", marginTop: 4, textTransform: "uppercase", letterSpacing: "1px" },
  bar: () => ({ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }),
  barFill: (pct, c) => ({ height: "100%", borderRadius: 3, width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${c}, ${c}88)`, transition: "width 0.6s ease" }),
  gameRow: (w) => ({ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 6, cursor: "pointer", background: w ? "rgba(0,255,136,0.04)" : "rgba(255,60,60,0.04)", borderLeft: `3px solid ${w ? "#00ff88" : "#ff3c3c"}`, transition: "all 0.2s" }),
  modal: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { background: "#0f1624", border: "1px solid rgba(0,194,255,0.15)", borderRadius: 18, padding: 32, maxWidth: 500, width: "90%", textAlign: "center" },
  textarea: { background: "rgba(0,10,20,0.6)", border: "1px solid rgba(0,194,255,0.15)", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 80 },
  streamText: { background: "rgba(0,10,20,0.5)", borderRadius: 10, padding: 16, border: "1px solid rgba(0,194,255,0.08)", fontSize: 13, lineHeight: 1.7, color: "#c8d6e5", maxHeight: 400, overflowY: "auto", whiteSpace: "pre-wrap" },
  lock: { position: "relative", opacity: 0.4, pointerEvents: "none", filter: "blur(2px)" },
  lockOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(10,14,23,0.85)", borderRadius: 14, zIndex: 10, cursor: "pointer", pointerEvents: "auto" },
  champImg: { width: 36, height: 36, borderRadius: 8, objectFit: "cover" },
  champImgSm: { width: 28, height: 28, borderRadius: 6, objectFit: "cover" },
  itemImg: { width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(0,194,255,0.1)" },
  error: { padding: "12px 16px", borderRadius: 10, background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.2)", color: "#ff6666", fontSize: 13, marginTop: 12 },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", padding: 40, color: "#5a7a9a", fontSize: 14 },
};

// ── UI COMPONENTS ──────────────────────────────
function StatBox({ value, label, color = "#00c2ff" }) {
  return <div style={S.statBox}><div style={{ ...S.statVal, color }}>{value}</div><div style={S.statLabel}>{label}</div></div>;
}

function ProgressBar({ value, max = 100, color = "#00c2ff", label }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#8899aa" }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{typeof value === 'number' ? value.toFixed?.(1) || value : value}/{max}</span>
      </div>}
      <div style={S.bar()}><div style={S.barFill(pct, color)} /></div>
    </div>
  );
}

function PremiumGate({ children, feature, isPro, onUpgrade }) {
  if (isPro) return children;
  return (
    <div style={{ position: "relative" }}>
      <div style={S.lock}>{children}</div>
      <div style={S.lockOverlay} onClick={onUpgrade}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ff9500" }}>{feature}</div>
        <div style={{ fontSize: 12, color: "#5a7a9a", marginTop: 4 }}>Débloquer avec Pro</div>
      </div>
    </div>
  );
}

function ChampImg({ src, name, size = "normal" }) {
  const style = size === "sm" ? S.champImgSm : S.champImg;
  if (!src) return <div style={{ ...style, background: "rgba(0,194,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size === "sm" ? 14 : 18 }}>🎮</div>;
  return <img src={src} alt={name} style={style} onError={e => { e.target.style.display = 'none'; }} />;
}

// ── STREAM AI HELPER ───────────────────────────
async function streamAI(prompt, onChunk) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, stream: true, messages: [{ role: "user", content: prompt }] }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === "content_block_delta" && parsed.delta?.text) onChunk(parsed.delta.text);
        } catch {}
      }
    }
  }
}

// ══════════════════════════════════════════════════
// TAB: DASHBOARD
// ══════════════════════════════════════════════════
function DashboardTab({ profile, games, isPro, onUpgrade }) {
  if (!games.length) return <div style={S.card}><div style={S.loading}>Aucune game chargée</div></div>;
  const wins = games.filter(g => g.win).length;
  const wr = ((wins / games.length) * 100).toFixed(1);
  const avgKDA = (games.reduce((s, g) => s + (g.deaths === 0 ? 10 : (g.kills + g.assists) / g.deaths), 0) / games.length).toFixed(2);
  const avgCS = Math.round(games.reduce((s, g) => s + g.cs, 0) / games.length);
  const avgVision = Math.round(games.reduce((s, g) => s + g.vision, 0) / games.length);

  const champStats = {};
  games.forEach(g => {
    const n = g.championName;
    if (!champStats[n]) champStats[n] = { wins: 0, games: 0, img: g.champion?.image };
    champStats[n].games++;
    if (g.win) champStats[n].wins++;
  });
  const topChamps = Object.entries(champStats).sort((a, b) => b[1].games - a[1].games).slice(0, 5);

  return (
    <>
      {/* Profile card */}
      {profile && (
        <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 20 }}>
          <img src={profile.profileIcon} alt="" style={{ width: 64, height: 64, borderRadius: 12, border: "2px solid rgba(0,194,255,0.3)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{profile.gameName}<span style={{ color: "#5a7a9a" }}>#{profile.tagLine}</span></div>
            <div style={{ fontSize: 12, color: "#5a7a9a" }}>Niveau {profile.summonerLevel}</div>
          </div>
          {profile.soloQ && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#ffaa00" }}>{profile.soloQ.tier} {profile.soloQ.rank}</div>
              <div style={{ fontSize: 13, color: "#c8d6e5" }}>{profile.soloQ.lp} LP · {profile.soloQ.winRate}% WR</div>
              <div style={{ fontSize: 11, color: "#5a7a9a" }}>{profile.soloQ.wins}W {profile.soloQ.losses}L</div>
            </div>
          )}
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardTitle}>📊 Vue d'ensemble — {games.length} dernières games</div>
        <div style={{ ...S.grid3, marginBottom: 20 }}>
          <StatBox value={`${wr}%`} label="Win Rate" color={wr >= 50 ? "#00ff88" : "#ff3c3c"} />
          <StatBox value={avgKDA} label="KDA moyen" color="#00c2ff" />
          <StatBox value={`${wins}W ${games.length - wins}L`} label="Bilan" color="#ffaa00" />
        </div>
        <div style={S.grid2}>
          <div>
            <ProgressBar value={avgCS} max={300} color="#ffaa00" label="CS moyen" />
            <ProgressBar value={avgVision} max={50} color="#aa66ff" label="Vision moyen" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#5a7a9a", marginBottom: 8, textTransform: "uppercase", letterSpacing: "1px" }}>Champions joués</div>
            {topChamps.map(([name, data]) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <ChampImg src={data.img} name={name} size="sm" />
                <span style={{ fontSize: 13, color: "#fff", flex: 1 }}>{name}</span>
                <span style={{ fontSize: 12, color: data.wins / data.games >= 0.5 ? "#00ff88" : "#ff3c3c", fontWeight: 700 }}>
                  {((data.wins / data.games) * 100).toFixed(0)}% ({data.games}g)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Chart */}
      <div style={S.card}>
        <div style={S.cardTitle}>📈 KPI — Progression</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, padding: "0 4px" }}>
          {games.slice().reverse().map((g, i) => {
            const kda = g.deaths === 0 ? 10 : (g.kills + g.assists) / g.deaths;
            const h = Math.min((kda / 8) * 100, 100);
            return <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ height: `${h}%`, minHeight: 4, width: "100%", borderRadius: 3, background: g.win ? "linear-gradient(180deg, #00ff88, #00ff8844)" : "linear-gradient(180deg, #ff3c3c, #ff3c3c44)" }} /></div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: "#5a7a9a" }}>Ancienne</span>
          <span style={{ fontSize: 10, color: "#5a7a9a" }}>Récente</span>
        </div>
      </div>

      <PremiumGate feature="Patterns avancés & tendances" isPro={isPro} onUpgrade={onUpgrade}>
        <div style={S.card}>
          <div style={S.cardTitle}>🧠 Patterns détectés (IA)</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,60,60,0.08)", marginBottom: 8 }}>⚠️ Analyse des patterns de jeu disponible en Pro</div>
          </div>
        </div>
      </PremiumGate>
    </>
  );
}

// ══════════════════════════════════════════════════
// TAB: COACH IA
// ══════════════════════════════════════════════════
function CoachTab({ games, isPro, onUpgrade }) {
  const [streaming, setStreaming] = useState(false);
  const [response, setResponse] = useState("");
  const [sel, setSel] = useState(0);
  const [count, setCount] = useState(0);
  const FREE = 2;

  const analyze = async () => {
    if (!isPro && count >= FREE) return;
    const g = games[sel];
    if (!g) return;
    setStreaming(true); setResponse(""); setCount(c => c + 1);
    const profile = getEnemyDamageProfile(g.enemyTeam);
    const prompt = `Tu es un coach LoL Diamond+. Analyse cette game RÉELLE et donne des conseils actionnables.

GAME DATA:
- Champion: ${g.championName} (${g.role})
- Résultat: ${g.win ? "VICTOIRE" : "DÉFAITE"} en ${g.duration}min
- KDA: ${g.kills}/${g.deaths}/${g.assists} (${g.kda})
- CS: ${g.cs} (${g.csPerMin}/min)
- Vision score: ${g.vision} (wards posées: ${g.wardsPlaced}, détruites: ${g.wardsKilled})
- Dégâts infligés: ${g.damageDealt?.toLocaleString()} | Dégâts subis: ${g.damageTaken?.toLocaleString()}
- Gold: ${g.goldEarned?.toLocaleString()}
- Items: ${g.items.map(i => i.name).join(", ")}
- Ennemis: ${g.enemyTeam.map(e => `${e.championName} (${e.kills}/${e.deaths}/${e.assists})`).join(", ")}
- Profil ennemi: ${profile.ad} AD, ${profile.ap} AP, ${profile.tank} Tank

Réponds en français. Structure:
1. 🎯 Résumé (2 lignes)
2. ✅ Points forts (2-3)
3. ⚠️ Erreurs identifiées (2-3 avec timings précis)
4. 🛠️ Plan d'action (3 conseils ultra précis)
5. 📈 Objectif prochaine game`;

    try { await streamAI(prompt, t => setResponse(p => p + t)); }
    catch { setResponse("Erreur de connexion à l'IA."); }
    setStreaming(false);
  };

  return (
    <>
      <div style={S.card}>
        <div style={S.cardTitle}>🤖 Coach IA — Analyse de game</div>
        <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
          {games.slice(0, 10).map((g, i) => (
            <div key={i} style={{ ...S.gameRow(g.win), outline: sel === i ? "1px solid #00c2ff" : "none" }} onClick={() => setSel(i)}>
              <ChampImg src={g.champion?.image} name={g.championName} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{g.championName} <span style={{ fontSize: 11, color: "#5a7a9a" }}>({g.role})</span></div>
                <div style={{ fontSize: 11, color: "#5a7a9a" }}>{g.date} · {g.duration}min · {g.csPerMin} CS/min</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {g.items.slice(0, 4).map((it, j) => <img key={j} src={it.image} alt="" style={{ width: 24, height: 24, borderRadius: 4 }} onError={e => e.target.style.display = 'none'} />)}
              </div>
              <div style={{ textAlign: "right", minWidth: 70 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: g.win ? "#00ff88" : "#ff3c3c" }}>{g.kills}/{g.deaths}/{g.assists}</div>
                <span style={S.tag(g.win ? "#00ff88" : "#ff3c3c")}>{g.win ? "WIN" : "LOSS"}</span>
              </div>
            </div>
          ))}
        </div>
        {!isPro && count >= FREE ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 14, color: "#ff9500", fontWeight: 700, marginBottom: 8 }}>🔒 {FREE} analyses gratuites utilisées</div>
            <button style={S.premiumBadge} onClick={onUpgrade}>Passer Pro</button>
          </div>
        ) : (
          <button style={S.btn("#00c2ff")} onClick={analyze} disabled={streaming}>
            {streaming ? "⏳ Analyse en cours..." : `🧠 Lancer l'analyse IA ${!isPro ? `(${FREE - count} restantes)` : ""}`}
          </button>
        )}
      </div>
      {response && <div style={S.card}><div style={S.cardTitle}>💬 Coaching IA{streaming && <span style={{ fontSize: 11, color: "#00c2ff", marginLeft: 8 }}>● streaming</span>}</div><div style={S.streamText}>{response}</div></div>}
    </>
  );
}

// ══════════════════════════════════════════════════
// TAB: ITEMS ANALYZER
// ══════════════════════════════════════════════════
function ItemsTab({ games, isPro, onUpgrade }) {
  const [sel, setSel] = useState(0);
  const [aiText, setAiText] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState(null);

  const g = games[sel];
  const profile = g ? getEnemyDamageProfile(g.enemyTeam) : null;
  const scored = g ? g.items.map(it => ({ ...it, ...scoreItemVsComp(it, profile) })) : [];
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length * 10) : 0;

  const loadTimeline = async () => {
    if (!g) return;
    try {
      const data = await apiCall(`/timeline/${g.id}/${games._puuid || ''}`);
      setTimeline(data);
    } catch {}
  };

  useEffect(() => { setTimeline(null); setAiText(""); }, [sel]);

  const analyzeItems = async () => {
    if (!g) return;
    setLoading(true); setAiText("");
    const prompt = `Expert LoL itemisation. Analyse le build RÉEL de ce joueur.

Champion: ${g.championName} (${g.role})
Build: ${g.items.map(i => i.name).join(", ")}
Ennemis: ${g.enemyTeam.map(e => e.championName).join(", ")} (${profile.ad} AD, ${profile.ap} AP, ${profile.tank} Tank)
Résultat: ${g.win ? "Victoire" : "Défaite"} en ${g.duration}min
Dégâts: ${g.damageDealt?.toLocaleString()} infligés, ${g.damageTaken?.toLocaleString()} subis

Analyse en français:
1. Score global /100
2. Chaque item: bon/mauvais vs cette compo
3. Items manquants critiques
4. Build optimal recommandé

Sois ultra concret.`;
    try { await streamAI(prompt, t => setAiText(p => p + t)); }
    catch { setAiText("Erreur."); }
    setLoading(false);
  };

  return (
    <>
      <div style={S.card}>
        <div style={S.cardTitle}>🛡️ Analyse Itemisation</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {games.slice(0, 8).map((g2, i) => (
            <button key={i} style={S.btnSm(g2.win ? "#00ff88" : "#ff3c3c", sel === i)} onClick={() => setSel(i)}>
              {g2.championName}
            </button>
          ))}
        </div>
        {g && (
          <>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
              <StatBox value={`${avg}/100`} label="Score build" color={avg >= 70 ? "#00ff88" : avg >= 50 ? "#ffaa00" : "#ff3c3c"} />
              <StatBox value={`${profile.ad}AD ${profile.ap}AP`} label="Profil ennemi" color="#ff66aa" />
              <StatBox value={g.win ? "WIN" : "LOSS"} label={`${g.duration}min`} color={g.win ? "#00ff88" : "#ff3c3c"} />
            </div>

            <div style={{ fontSize: 12, color: "#ffaa00", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1px" }}>Build du joueur</div>
            {scored.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: it.score >= 7 ? "rgba(0,255,136,0.06)" : it.score >= 5 ? "rgba(255,170,0,0.06)" : "rgba(255,60,60,0.06)", borderLeft: `3px solid ${it.score >= 7 ? "#00ff88" : it.score >= 5 ? "#ffaa00" : "#ff3c3c"}` }}>
                {it.image && <img src={it.image} alt="" style={S.itemImg} onError={e => e.target.style.display = 'none'} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: "#5a7a9a" }}>{it.reason} · {it.cost}g</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: it.score >= 7 ? "#00ff88" : it.score >= 5 ? "#ffaa00" : "#ff3c3c" }}>{it.score}/10</div>
              </div>
            ))}

            <div style={{ fontSize: 12, color: "#ff66aa", fontWeight: 700, marginTop: 16, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1px" }}>Compo ennemie</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {g.enemyTeam.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(255,102,170,0.06)", border: "1px solid rgba(255,102,170,0.15)" }}>
                  <ChampImg src={e.champion?.image} name={e.championName} size="sm" />
                  <div>
                    <div style={{ fontSize: 12, color: "#fff" }}>{e.championName}</div>
                    <div style={{ fontSize: 10, color: "#5a7a9a" }}>{e.kills}/{e.deaths}/{e.assists}</div>
                  </div>
                </div>
              ))}
            </div>

            <button style={{ ...S.btn("#aa66ff"), marginTop: 16 }} onClick={analyzeItems} disabled={loading}>
              {loading ? "⏳ Analyse IA..." : "🧠 Analyse IA de l'itemisation"}
            </button>
          </>
        )}
      </div>
      {aiText && <div style={S.card}><div style={S.cardTitle}>💬 Analyse IA{loading && <span style={{ fontSize: 11, color: "#aa66ff", marginLeft: 8 }}>● streaming</span>}</div><div style={S.streamText}>{aiText}</div></div>}
    </>
  );
}

// ══════════════════════════════════════════════════
// TAB: MENTAL TRACKER
// ══════════════════════════════════════════════════
function MentalTab({ isPro, onUpgrade }) {
  const [entries, setEntries] = useState([]);
  const [mood, setMood] = useState(3);
  const [tilt, setTilt] = useState(2);
  const [energy, setEnergy] = useState(3);
  const [note, setNote] = useState("");

  useEffect(() => { loadStorage("mental-entries").then(d => d && setEntries(d)); }, []);

  const add = () => {
    const entry = { id: Date.now(), date: new Date().toLocaleString("fr-FR"), mood, tilt, energy, note };
    const updated = [entry, ...entries].slice(0, 50);
    setEntries(updated);
    saveStorage("mental-entries", updated);
    setNote(""); setMood(3); setTilt(2); setEnergy(3);
  };

  const moodEmojis = ["😤", "😞", "😐", "🙂", "😎"];
  const tiltLabels = ["Zen", "Léger", "Moyen", "Fort", "Extreme"];
  const energyLabels = ["Épuisé", "Fatigué", "Normal", "Énergique", "On fire"];
  const avgTilt = entries.length ? (entries.reduce((s, e) => s + e.tilt, 0) / entries.length).toFixed(1) : "-";

  return (
    <>
      <div style={S.card}>
        <div style={S.cardTitle}>🧠 Mental Tracker</div>
        <div style={{ ...S.grid3, marginBottom: 16 }}>
          <div style={S.statBox}>
            <div style={{ fontSize: 12, color: "#5a7a9a", marginBottom: 8 }}>Humeur</div>
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {moodEmojis.map((e, i) => <button key={i} onClick={() => setMood(i)} style={{ fontSize: mood === i ? 28 : 20, cursor: "pointer", background: "none", border: "none", opacity: mood === i ? 1 : 0.4 }}>{e}</button>)}
            </div>
          </div>
          <div style={S.statBox}>
            <div style={{ fontSize: 12, color: "#5a7a9a", marginBottom: 8 }}>Tilt ({tiltLabels[tilt]})</div>
            <input type="range" min="0" max="4" value={tilt} onChange={e => setTilt(+e.target.value)} style={{ width: "80%", accentColor: tilt >= 3 ? "#ff3c3c" : "#00ff88" }} />
          </div>
          <div style={S.statBox}>
            <div style={{ fontSize: 12, color: "#5a7a9a", marginBottom: 8 }}>Énergie ({energyLabels[energy]})</div>
            <input type="range" min="0" max="4" value={energy} onChange={e => setEnergy(+e.target.value)} style={{ width: "80%", accentColor: "#00c2ff" }} />
          </div>
        </div>
        <textarea style={S.textarea} value={note} onChange={e => setNote(e.target.value)} placeholder="Notes sur ta session..." rows={2} />
        <button style={{ ...S.btn("#00c2ff"), marginTop: 12 }} onClick={add}>📝 Enregistrer</button>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>📊 Stats mentales</div>
        <div style={S.grid3}>
          <StatBox value={entries.length ? moodEmojis[Math.round(entries.reduce((s, e) => s + e.mood, 0) / entries.length)] : "—"} label="Humeur moy." />
          <StatBox value={avgTilt} label="Tilt moyen /4" color={avgTilt >= 2.5 ? "#ff3c3c" : "#00ff88"} />
          <StatBox value={entries.length} label="Entrées" color="#aa66ff" />
        </div>
        <PremiumGate feature="Corrélations mental ↔ performance" isPro={isPro} onUpgrade={onUpgrade}>
          <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(255,60,60,0.08)", fontSize: 13 }}>
            ⚠️ Quand tu es très tilté (3+), ton WR chute de 22% en moyenne. Stoppe après 2 défaites consécutives.
          </div>
        </PremiumGate>
      </div>

      {entries.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>📋 Historique</div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {entries.slice(0, 15).map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 4, background: "rgba(0,10,20,0.4)" }}>
                <span style={{ fontSize: 22 }}>{moodEmojis[e.mood]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#fff" }}>Tilt: <span style={{ color: e.tilt >= 3 ? "#ff3c3c" : "#00ff88" }}>{tiltLabels[e.tilt]}</span> · Énergie: <span style={{ color: "#00c2ff" }}>{energyLabels[e.energy]}</span></div>
                  {e.note && <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 2 }}>{e.note}</div>}
                </div>
                <div style={{ fontSize: 10, color: "#5a7a9a" }}>{e.date}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════
// TAB: FEEDBACK
// ══════════════════════════════════════════════════
function FeedbackTab() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [category, setCategory] = useState("suggestion");
  const [pseudo, setPseudo] = useState("");
  const [rank, setRank] = useState("Gold");
  const [message, setMessage] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [aiSum, setAiSum] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => { loadStorage("user-feedbacks", true).then(d => d && setFeedbacks(d)); }, []);

  const cats = [
    { v: "bug", l: "🐛 Bug", c: "#ff3c3c" }, { v: "suggestion", l: "💡 Suggestion", c: "#ffaa00" },
    { v: "coaching", l: "🤖 Coach IA", c: "#00c2ff" }, { v: "items", l: "🛡️ Items", c: "#aa66ff" },
    { v: "mental", l: "🧠 Mental", c: "#00ff88" }, { v: "ux", l: "🎨 UX", c: "#ff66aa" },
  ];

  const submit = () => {
    if (!message.trim()) return;
    const fb = { id: Date.now(), date: new Date().toLocaleString("fr-FR"), category, pseudo: pseudo || "Anonyme", rank, message, upvotes: 0 };
    const updated = [fb, ...feedbacks];
    setFeedbacks(updated);
    saveStorage("user-feedbacks", updated, true);
    setMessage("");
  };

  const upvote = (id) => {
    const updated = feedbacks.map(f => f.id === id ? { ...f, upvotes: f.upvotes + 1 } : f);
    setFeedbacks(updated);
    saveStorage("user-feedbacks", updated, true);
  };

  const analyze = async () => {
    setAnalyzing(true); setAiSum("");
    const prompt = `Product manager. Analyse ces retours d'une app coaching LoL.\n\n${feedbacks.slice(0, 20).map(f => `[${f.category}][${f.rank}] ${f.pseudo}: "${f.message}" (${f.upvotes} upvotes)`).join("\n")}\n\nEn français:\n1. Thèmes récurrents top 3\n2. Action prioritaire #1\n3. Quick wins`;
    try { await streamAI(prompt, t => setAiSum(p => p + t)); }
    catch { setAiSum("Erreur."); }
    setAnalyzing(false);
  };

  const filtered = filterCat === "all" ? feedbacks : feedbacks.filter(f => f.category === filterCat);

  return (
    <>
      <div style={S.card}>
        <div style={S.cardTitle}>💬 Remarques</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {cats.map(c => <button key={c.v} style={S.btnSm(c.c, category === c.v)} onClick={() => setCategory(c.v)}>{c.l}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input style={{ ...S.input, flex: 1 }} value={pseudo} onChange={e => setPseudo(e.target.value)} placeholder="Pseudo" />
          <select style={{ ...S.input, flex: 1, cursor: "pointer" }} value={rank} onChange={e => setRank(e.target.value)}>
            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <textarea style={S.textarea} value={message} onChange={e => setMessage(e.target.value)} placeholder="Ta remarque..." rows={3} />
        <button style={{ ...S.btn("#00c2ff"), marginTop: 12 }} onClick={submit}>📤 Envoyer</button>
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={S.cardTitle}>📋 Retours ({feedbacks.length})</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={S.btnSm("#c8d6e5", filterCat === "all")} onClick={() => setFilterCat("all")}>Tous</button>
            {cats.map(c => <button key={c.v} style={S.btnSm(c.c, filterCat === c.v)} onClick={() => setFilterCat(c.v)}>{c.l.split(" ")[0]}</button>)}
          </div>
        </div>
        {filtered.length === 0 ? <div style={{ textAlign: "center", padding: 30, color: "#5a7a9a" }}>Aucun feedback</div> : (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {filtered.sort((a, b) => b.upvotes - a.upvotes).map(f => {
              const cat = cats.find(c => c.v === f.category);
              return (
                <div key={f.id} style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 6, background: "rgba(0,10,20,0.4)", borderLeft: `3px solid ${cat?.c || "#5a7a9a"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={S.tag(cat?.c || "#5a7a9a")}>{cat?.l || f.category}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{f.pseudo}</span>
                    <span style={S.tag("#5a7a9a")}>{f.rank}</span>
                    <span style={{ fontSize: 10, color: "#5a7a9a", marginLeft: "auto" }}>{f.date}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#c8d6e5" }}>{f.message}</div>
                  <button onClick={() => upvote(f.id)} style={{ background: "none", border: "1px solid rgba(255,170,0,0.2)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: "#ffaa00", fontSize: 12, marginTop: 6 }}>👍 {f.upvotes}</button>
                </div>
              );
            })}
          </div>
        )}
        {feedbacks.length >= 3 && <button style={{ ...S.btn("#ff66aa"), marginTop: 16 }} onClick={analyze} disabled={analyzing}>{analyzing ? "⏳..." : "🧠 Analyser les retours (IA)"}</button>}
      </div>
      {aiSum && <div style={S.card}><div style={S.cardTitle}>📊 Analyse IA{analyzing && <span style={{ fontSize: 11, color: "#ff66aa", marginLeft: 8 }}>●</span>}</div><div style={S.streamText}>{aiSum}</div></div>}
    </>
  );
}

// ══════════════════════════════════════════════════
// UPGRADE MODAL
// ══════════════════════════════════════════════════
function UpgradeModal({ onClose, onUpgrade }) {
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>🚀 Passe à Pro</div>
        <div style={{ fontSize: 13, color: "#5a7a9a", marginBottom: 24 }}>Débloque tout le coaching IA</div>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { name: "Gratuit", price: "0€", features: ["2 analyses IA/jour", "Dashboard basique", "Mental tracker (log)"] },
            { name: "Pro", price: "9€/mois", sub: "ou 79€/an (-27%)", features: ["Analyses IA illimitées", "Corrélations mental avancées", "Build optimal Lolalytics", "Patterns & tendances", "Support prioritaire"], hl: true },
          ].map(p => (
            <div key={p.name} style={{ flex: 1, padding: 20, borderRadius: 14, background: p.hl ? "rgba(0,194,255,0.08)" : "rgba(0,10,20,0.5)", border: p.hl ? "2px solid #00c2ff" : "1px solid rgba(255,255,255,0.06)", textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: p.hl ? "#00c2ff" : "#fff", marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{p.price}</div>
              {p.sub && <div style={{ fontSize: 11, color: "#5a7a9a", marginBottom: 12 }}>{p.sub}</div>}
              {p.features.map((f, i) => <div key={i} style={{ fontSize: 12, color: "#8899aa", marginBottom: 4 }}><span style={{ color: p.hl ? "#00ff88" : "#5a7a9a" }}>✓</span> {f}</div>)}
              {p.hl && <button style={{ ...S.btn("#00c2ff"), width: "100%", marginTop: 12 }} onClick={onUpgrade}>7 jours gratuits</button>}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a7a9a", marginTop: 16, cursor: "pointer", fontSize: 12 }}>Fermer</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [summonerInput, setSummonerInput] = useState("");
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendOk, setBackendOk] = useState(null);

  // Check backend health
  useEffect(() => {
    apiCall("/health").then(d => setBackendOk(d)).catch(() => setBackendOk(false));
  }, []);

  const search = async () => {
    const parts = summonerInput.trim().split("#");
    if (parts.length !== 2) { setError("Format: NomDuJoueur#TAG (ex: Faker#KR1)"); return; }
    const [name, tag] = parts;
    setLoading(true); setError(""); setProfile(null); setGames([]);

    try {
      // 1. Profil
      const p = await apiCall(`/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
      setProfile(p);

      // 2. Games
      const data = await apiCall(`/matches/${p.puuid}?count=20&type=all`);
      const gamesWithPuuid = data.games;
      gamesWithPuuid._puuid = p.puuid;
      setGames(gamesWithPuuid);
      setTab("dashboard");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const openUpgrade = () => setShowUpgrade(true);
  const tabs = [
    { id: "dashboard", l: "📊 Dashboard" }, { id: "coach", l: "🤖 Coach IA" },
    { id: "items", l: "🛡️ Items" }, { id: "mental", l: "🧠 Mental" },
    { id: "feedback", l: "💬 Remarques" },
  ];

  return (
    <div style={S.app}>
      <div style={S.bgGlow} />
      <div style={S.container}>
        <div style={S.header}>
          <div style={S.logo}>
            <div style={S.logoIcon}>LC</div>
            <div>
              <div style={S.logoText}>LoL Coach Pro</div>
              <div style={S.logoSub}>Coach IA + Mental + Items</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input style={{ ...S.input, width: 200 }} value={summonerInput} onChange={e => setSummonerInput(e.target.value)}
              placeholder="Pseudo#TAG" onKeyDown={e => e.key === "Enter" && search()} />
            <button style={S.btn("#00c2ff")} onClick={search} disabled={loading}>
              {loading ? "⏳" : "🔍"}
            </button>
            {isPro ? <span style={S.tag("#00ff88")}>✓ PRO</span> : <button style={S.premiumBadge} onClick={openUpgrade}>⚡ PRO</button>}
          </div>
        </div>

        {/* Backend status */}
        {backendOk === false && (
          <div style={S.error}>
            ⚠️ <strong>Backend non détecté</strong> sur localhost:3001 — lance le serveur avec <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4 }}>npm start</code> pour avoir les vraies données Riot.
          </div>
        )}
        {backendOk && !backendOk.riotApiConnected && (
          <div style={{ ...S.error, background: "rgba(255,170,0,0.1)", borderColor: "rgba(255,170,0,0.2)", color: "#ffaa00" }}>
            ⚠️ Backend OK mais <strong>clé Riot API non configurée</strong> — copie ta clé dans le fichier .env
          </div>
        )}
        {error && <div style={S.error}>❌ {error}</div>}

        <div style={S.nav}>
          {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.l}</button>)}
        </div>

        <div style={{ paddingBottom: 40 }}>
          {tab === "dashboard" && <DashboardTab profile={profile} games={games} isPro={isPro} onUpgrade={openUpgrade} />}
          {tab === "coach" && <CoachTab games={games} isPro={isPro} onUpgrade={openUpgrade} />}
          {tab === "items" && <ItemsTab games={games} isPro={isPro} onUpgrade={openUpgrade} />}
          {tab === "mental" && <MentalTab isPro={isPro} onUpgrade={openUpgrade} />}
          {tab === "feedback" && <FeedbackTab />}
        </div>

        <div style={{ textAlign: "center", padding: "20px 0 30px", borderTop: "1px solid rgba(0,194,255,0.08)", fontSize: 11, color: "#3a4a5a" }}>
          LoL Coach Pro · v2.0 · {backendOk ? `Backend ✅ ${backendOk.region}` : "Backend ❌"} · {backendOk?.riotApiConnected ? "Riot API ✅" : "Riot API ❌"}
          {!isPro && <div style={{ marginTop: 8 }}><button style={{ background: "none", border: "none", color: "#5a7a9a", cursor: "pointer", fontSize: 11, textDecoration: "underline" }} onClick={() => setIsPro(true)}>[Dev] Mode Pro</button></div>}
        </div>
      </div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={() => { setIsPro(true); setShowUpgrade(false); }} />}
    </div>
  );
}
