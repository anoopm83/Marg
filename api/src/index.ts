import "dotenv/config";
import express from "express";
import cors from "cors";
import { run, get, all, initDb, IS_TURSO } from "./db.js";
import { auth, id, now, hash, verify, newToken, type AuthedRequest } from "./auth.js";
import { options } from "./dataset.js";
import { getPack, getConfig, personaList } from "./personas.js";
import { reflect, planReflect, chat, interpretFeedback, type ChatMsg, MODEL, hasKey, PROVIDER } from "./llm.js";
import { checkDistress, HELPLINES } from "./safety.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === "production";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "64kb" }));
// Baseline security headers (kept minimal — the SPA needs inline styles/scripts).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

// ---- SQL (libSQL is async; ? placeholders, args as arrays) ----
const SQL = {
  insUser: "INSERT INTO users (id, user_handle, password_hash, email, is_minor, created_at) VALUES (?,?,?,?,?,?)",
  getUserByHandle: "SELECT * FROM users WHERE user_handle = ?",
  insConsent: "INSERT INTO consent (id, user_id, path, parental_status, school_code, consented_at) VALUES (?,?,?,?,?,?)",
  insSession: "INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
  delSession: "DELETE FROM sessions WHERE token = ?",
  upsertIntake: "INSERT INTO intake (user_id, data, updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
  getIntake: "SELECT data FROM intake WHERE user_id = ?",
  getShortlist: "SELECT option_id, note, added_at FROM shortlist_items WHERE user_id = ? ORDER BY added_at",
  hasShortlistItem: "SELECT id FROM shortlist_items WHERE user_id = ? AND option_id = ?",
  insShortlist: "INSERT INTO shortlist_items (id, user_id, option_id, note, added_at) VALUES (?,?,?,?,?)",
  delShortlist: "DELETE FROM shortlist_items WHERE user_id = ? AND option_id = ?",
  insEvent: "INSERT INTO events (id, user_id, name, props, ts) VALUES (?,?,?,?,?)",
  insFeedback: "INSERT INTO feedback (id, user_id, persona, context, rating, category, text, status, created_at) VALUES (?,?,?,?,?,?,?, 'new', ?)",
  setFeedbackAI: "UPDATE feedback SET ai_theme=?, ai_sentiment=?, ai_severity=?, ai_summary=?, ai_suggestion=? WHERE id=?",
  setFeedbackStatus: "UPDATE feedback SET status=? WHERE id=?",
  anonFeedback: "UPDATE feedback SET user_id=NULL WHERE user_id=?",
};

async function logEvent(userId: string | null, name: string, props: any) {
  try { await run(SQL.insEvent, [id(), userId, name, props ? JSON.stringify(props) : null, now()]); } catch { /* non-fatal */ }
}

// Wrap an async route so thrown errors reach the error handler instead of hanging.
type A = (req: any, res: express.Response) => Promise<unknown>;
const h = (fn: A) => (req: express.Request, res: express.Response, next: express.NextFunction) => Promise.resolve(fn(req, res)).catch(next);

// ---- health & content ----
app.get("/api/health", (_req, res) => res.json({ ok: true, provider: PROVIDER, model: MODEL, ai_key_detected: hasKey, options: options.length, store: IS_TURSO ? "turso" : "sqlite-file" }));
// Public runtime config for the front-end (PostHog project keys are public/client-side).
// Set POSTHOG_KEY in the host env to enable analytics — no rebuild needed.
app.get("/api/config", (_req, res) => res.json({
  posthog: { key: process.env.POSTHOG_KEY || null, host: process.env.POSTHOG_HOST || "https://us.i.posthog.com" },
  appVersion: process.env.APP_VERSION || "0.1.0",
}));
// Persona registry for the picker (config only, no data pack).
app.get("/api/personas", (_req, res) => res.json({ personas: personaList }));
app.get("/api/options", (req, res) => {
  const pack = getPack(req.query.persona); // unknown/absent → class10 (default + fallback)
  res.json({ options: pack.options, scholarships: pack.scholarships, pathways: pack.pathways, specialized: pack.specializedPathways, disclaimer: pack.disclaimer });
});
app.get("/api/option/:id", (req, res) => {
  const o = getPack(req.query.persona).optById.get(req.params.id);
  return o ? res.json({ option: o }) : res.status(404).json({ error: "unknown_option" });
});
app.get("/api/pathway/:id", (req, res) => {
  const p = getPack(req.query.persona).pathById.get(req.params.id);
  return p ? res.json({ pathway: p }) : res.status(404).json({ error: "unknown_pathway" });
});

// ---- auth ----
app.post("/api/register", h(async (req, res) => {
  const { userId, password, email, consent } = req.body || {};
  if (!userId || typeof userId !== "string" || userId.length < 3) return res.status(400).json({ error: "bad_user_id" });
  if (!password || typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "weak_password" });
  if (!consent || !["self_serve", "school_mediated"].includes(consent.path)) return res.status(400).json({ error: "consent_required" });
  if (await get(SQL.getUserByHandle, [userId])) return res.status(409).json({ error: "handle_taken" });

  const uid = id();
  await run(SQL.insUser, [uid, userId, hash(password), email || null, 1, now()]);
  // Prototype consent: recorded as verified for the chosen path. Production needs
  // real verifiable parental consent (DPDP) before this can be "verified".
  await run(SQL.insConsent, [id(), uid, consent.path, "verified", consent.school_code || null, now()]);
  const token = newToken();
  await run(SQL.insSession, [token, uid, now()]);
  await logEvent(uid, "account_created", { path: consent.path });
  return res.json({ token, userId });
}));

app.post("/api/login", h(async (req, res) => {
  const { userId, password } = req.body || {};
  const u = await get<any>(SQL.getUserByHandle, [userId]);
  if (!u || !verify(password || "", u.password_hash)) return res.status(401).json({ error: "invalid_credentials" });
  const token = newToken();
  await run(SQL.insSession, [token, u.id, now()]);
  return res.json({ token, userId: u.user_handle });
}));

app.post("/api/logout", auth, h(async (req: AuthedRequest, res) => {
  const header = req.header("authorization") || "";
  await run(SQL.delSession, [header.replace(/^Bearer\s+/i, "")]);
  res.json({ ok: true });
}));

// ---- intake ----
app.get("/api/intake", auth, h(async (req: AuthedRequest, res) => {
  const row = await get<{ data: string }>(SQL.getIntake, [req.userId!]);
  res.json({ intake: row ? JSON.parse(row.data) : null });
}));
app.post("/api/intake", auth, h(async (req: AuthedRequest, res) => {
  const data = req.body || {};
  await run(SQL.upsertIntake, [req.userId!, JSON.stringify(data), now()]);
  await logEvent(req.userId!, "intake_completed", { fields: Object.keys(data).length });
  res.json({ ok: true });
}));

// ---- reflections (grounded Claude) ----
app.post("/api/reflect", auth, h(async (req: AuthedRequest, res) => {
  const { optionId, persona } = req.body || {};
  const option = getPack(persona).optById.get(optionId);
  if (!option) return res.status(400).json({ error: "unknown_option" });
  if (!hasKey) return res.status(503).json({ error: "no_ai_key", message: `No key for LLM_PROVIDER='${PROVIDER}'. Set it in api/.env (see api/.env.example) to enable live reflections.` });
  const row = await get<{ data: string }>(SQL.getIntake, [req.userId!]);
  const profile = row ? JSON.parse(row.data) : {};
  try {
    const reflection = await reflect(profile, option, getConfig(persona).audience);
    await logEvent(req.userId!, "option_reflected", { option_id: optionId });
    res.json({ source: PROVIDER, model: MODEL, reflection });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: "reflect_failed", message: String(e?.message || e) });
  }
}));

app.post("/api/plan", auth, h(async (req: AuthedRequest, res) => {
  const { pathwayId, persona } = req.body || {};
  const pathway = getPack(persona).pathById.get(pathwayId);
  if (!pathway) return res.status(400).json({ error: "unknown_pathway" });
  if (!hasKey) return res.status(503).json({ error: "no_ai_key", message: `No key for LLM_PROVIDER='${PROVIDER}'. Set it in api/.env (see api/.env.example) to enable live reflections.` });
  const row = await get<{ data: string }>(SQL.getIntake, [req.userId!]);
  const profile = row ? JSON.parse(row.data) : {};
  try {
    const plan = await planReflect(profile, pathway, getConfig(persona).audience);
    res.json({ source: PROVIDER, model: MODEL, plan });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: "plan_failed", message: String(e?.message || e) });
  }
}));

// ---- conversational chat (grounded, no-verdict; safety-gated) ----
app.post("/api/chat", auth, h(async (req: AuthedRequest, res) => {
  const { mode, contextId, goal, messages, persona } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "no_messages" });

  // SAFETY GATE — server-side, before any LLM call. Scan the latest user turn.
  // Helplines are persona-appropriate (config-driven), falling back to the default set.
  const lastUser = [...messages].reverse().find((m: any) => m?.role === "user");
  if (lastUser && checkDistress(String(lastUser.content || ""))) {
    await logEvent(req.userId!, "distress_flag_raised", { source: "chat", mode, persona });
    return res.json({ safety: true, helplines: getConfig(persona).helplines || HELPLINES });
  }

  if (!hasKey) return res.status(503).json({ error: "no_ai_key", message: `No key for LLM_PROVIDER='${PROVIDER}'. Set it in api/.env to enable chat.` });

  const pack = getPack(persona);
  const row = await get<{ data: string }>(SQL.getIntake, [req.userId!]);
  const profile = row ? JSON.parse(row.data) : {};
  const chatMode: "explore" | "aspire" = mode === "aspire" ? "aspire" : "explore";
  const currentOption = chatMode === "explore" && contextId ? pack.optById.get(contextId) : null;
  const groundCtx = {
    student: { interests: profile?.interests ?? [], values: profile?.values ?? [] },
    current_focus: chatMode === "aspire"
      ? { kind: "goal", goal: goal || "(unspecified)" }
      : { kind: "option", option: currentOption ? { id: currentOption.id, name: currentOption.name } : null },
    ...pack.groundingFor(chatMode),
  };
  // Trim history sent to the model (keep it bounded); Zod-free prose output.
  const history: ChatMsg[] = messages.slice(-10).map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 1000),
  }));
  try {
    const cfg = getConfig(persona);
    const reply = await chat(groundCtx, history, cfg.audience, cfg.experimental);
    await logEvent(req.userId!, "chat_message", { mode, turns: history.length, persona });
    res.json({ source: PROVIDER, model: MODEL, reply });
  } catch (e: any) {
    const msg = String(e?.message || e);
    // Free-tier rate limit: answer honestly instead of a generic failure.
    if (/\b429\b|rate.?limit/i.test(msg)) {
      return res.json({ reply: "I'm getting a lot of questions right now and briefly hit my free-tier limit. Please wait about a minute, then ask again — I'll be right here." });
    }
    res.status(e?.status || 500).json({ error: "chat_failed", message: msg });
  }
}));

// ---- shortlist ----
app.get("/api/shortlist", auth, h(async (req: AuthedRequest, res) => {
  res.json({ shortlist: await all(SQL.getShortlist, [req.userId!]) });
}));
app.post("/api/shortlist", auth, h(async (req: AuthedRequest, res) => {
  const { optionId, note, persona } = req.body || {};
  if (!getPack(persona).optById.get(optionId)) return res.status(400).json({ error: "unknown_option" });
  if (!(await get(SQL.hasShortlistItem, [req.userId!, optionId]))) {
    await run(SQL.insShortlist, [id(), req.userId!, optionId, note || null, now()]);
    await logEvent(req.userId!, "shortlist_saved", { option_id: optionId });
  }
  res.json({ shortlist: await all(SQL.getShortlist, [req.userId!]) });
}));
app.delete("/api/shortlist/:optionId", auth, h(async (req: AuthedRequest, res) => {
  await run(SQL.delShortlist, [req.userId!, req.params.optionId]);
  res.json({ shortlist: await all(SQL.getShortlist, [req.userId!]) });
}));

// ---- DPDP: delete everything ----
app.delete("/api/me", auth, h(async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  await run(SQL.anonFeedback, [uid]); // keep the anonymous improvement signal, drop the linkage
  // Explicit cascade (no FK reliance across backends).
  await run("DELETE FROM shortlist_items WHERE user_id = ?", [uid]);
  await run("DELETE FROM intake WHERE user_id = ?", [uid]);
  await run("DELETE FROM consent WHERE user_id = ?", [uid]);
  await run("DELETE FROM sessions WHERE user_id = ?", [uid]);
  await run("DELETE FROM users WHERE id = ?", [uid]);
  res.json({ ok: true });
}));

// ---- feedback loop: user tells Marg what to improve ----
// The note is stored immediately; Marg interprets it in the background (theme,
// sentiment, severity, a summary, and a DRAFT suggestion) for the admin triage
// inbox. Interpretation never changes any product data — a human admin actions it.
app.post("/api/feedback", auth, h(async (req: AuthedRequest, res) => {
  const { text, rating, category, context, persona } = req.body || {};
  const body = String(text || "").trim().slice(0, 2000);
  if (!body) return res.status(400).json({ error: "empty_feedback" });
  const fid = id();
  await run(SQL.insFeedback, [fid, req.userId!, persona || null, context || null, rating || "", category || null, body, now()]);
  await logEvent(req.userId!, "feedback_submitted", { persona, category, hasRating: !!rating });
  res.json({ ok: true });
  // Fire-and-forget interpretation (response already sent; failures are swallowed).
  interpretFeedback(body, { persona, context, category, rating })
    .then((ai) => { if (ai) return run(SQL.setFeedbackAI, [ai.theme, ai.sentiment, ai.severity, ai.summary, ai.suggestion, fid]); })
    .catch(() => { /* best-effort; raw note remains visible to admin */ });
}));

app.post("/api/event", auth, h(async (req: AuthedRequest, res) => {
  const { name, props } = req.body || {};
  if (name) await logEvent(req.userId!, String(name), props);
  res.json({ ok: true });
}));

// ---- admin (metrics & KPIs) ----
// NOTE: admin/admin is a placeholder for the prototype ONLY — insecure; replace
// with real credentials + hashing before this is exposed anywhere public.
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin";
if (IS_PROD && ADMIN_PASS === "admin") {
  console.warn("⚠️  SECURITY: ADMIN_PASS is still the default 'admin'. Set ADMIN_USER/ADMIN_PASS env vars before exposing this publicly.");
}
const adminTokens = new Set<string>(); // in-memory sessions (cleared on restart)

app.post("/api/admin/login", (req, res) => {
  const { userId, password } = req.body || {};
  if (userId === ADMIN_USER && password === ADMIN_PASS) {
    const token = newToken();
    adminTokens.add(token);
    return res.json({ token });
  }
  return res.status(401).json({ error: "invalid_credentials" });
});

function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const t = (req.header("authorization") || "").replace(/^Bearer\s+/i, "");
  if (t && adminTokens.has(t)) return next();
  return res.status(401).json({ error: "unauthorized" });
}

app.get("/api/admin/metrics", adminAuth, h(async (_req, res) => {
  const n = async (sql: string): Promise<number> => Number((await get<any>(sql))?.n ?? 0);
  const totalUsers = await n("SELECT COUNT(*) n FROM users");
  const completedIntake = await n("SELECT COUNT(*) n FROM intake");
  const reflections = await n("SELECT COUNT(*) n FROM events WHERE name='option_reflected'");
  const chats = await n("SELECT COUNT(*) n FROM events WHERE name='chat_message'");
  const shortlistItems = await n("SELECT COUNT(*) n FROM shortlist_items");
  const usersWithShortlist = await n("SELECT COUNT(DISTINCT user_id) n FROM shortlist_items");
  const distress = await n("SELECT COUNT(*) n FROM events WHERE name='distress_flag_raised'");

  // ---- North Star (fair instrumentation) ----
  // intake ∩ explored ∩ converged, over everyone who entered. "Explored" = opened
  // an expansion path, took the nudge, OR compared >=2 distinct options.
  // "Converged" = saved a shortlist of 2 or more.
  const intakeSet = new Set<string>();
  for (const r of await all<any>("SELECT user_id AS uid FROM intake")) intakeSet.add(r.uid);

  const explored = new Set<string>();
  for (const r of await all<any>("SELECT DISTINCT user_id AS uid FROM events WHERE name IN ('specialized_viewed','nudge_engaged') AND user_id IS NOT NULL")) explored.add(r.uid);
  const optsByUser = new Map<string, Set<string>>(); // distinct options each user opened
  for (const r of await all<any>("SELECT user_id AS uid, props FROM events WHERE name IN ('option_reflected','option_viewed') AND user_id IS NOT NULL")) {
    try { const oid = JSON.parse(r.props || "{}").option_id; if (oid) { (optsByUser.get(r.uid) ?? optsByUser.set(r.uid, new Set()).get(r.uid)!).add(oid); } } catch { /* skip */ }
  }
  for (const [uid, s] of optsByUser) if (s.size >= 2) explored.add(uid);

  const converged = new Set<string>();
  for (const r of await all<any>("SELECT user_id AS uid FROM shortlist_items GROUP BY user_id HAVING COUNT(*) >= 2")) converged.add(r.uid);

  const exploredUnconsidered = explored.size;
  const savedShortlist = converged.size;
  let nsmNum = 0;
  for (const uid of intakeSet) if (explored.has(uid) && converged.has(uid)) nsmNum++;
  const nsmDen = totalUsers;
  // helpfulness: 👍/👎 ratings live in events; count them for a direct benefit read.
  let up = 0, down = 0;
  for (const r of await all<any>("SELECT props FROM events WHERE name='feedback'")) {
    try { const p = JSON.parse(r.props || "{}"); if (p.rating === "up") up++; else if (p.rating === "down") down++; } catch { /* skip */ }
  }
  const rated = up + down;
  const chatsByPersona: Record<string, number> = {};
  for (const r of await all<any>("SELECT props FROM events WHERE name='chat_message'")) {
    try { const p = JSON.parse(r.props || "{}"); const k = p.persona || "unknown"; chatsByPersona[k] = (chatsByPersona[k] || 0) + 1; } catch { /* skip */ }
  }
  // free-text feedback aggregates (from the feedback table)
  const feedbackTotal = await n("SELECT COUNT(*) n FROM feedback");
  const feedbackOpen = await n("SELECT COUNT(*) n FROM feedback WHERE status IN ('new','triaged')");
  const themes: Record<string, number> = {};
  const sentiment: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const r of await all<any>("SELECT ai_theme, ai_sentiment FROM feedback")) {
    const t = r.ai_theme || "Unclassified"; themes[t] = (themes[t] || 0) + 1;
    if (r.ai_sentiment && sentiment[r.ai_sentiment] != null) sentiment[r.ai_sentiment]++;
  }
  const topThemes = Object.entries(themes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([theme, count]) => ({ theme, count }));
  res.json({
    northStar: {
      name: "Informed-Convergence Rate",
      numerator: nsmNum, denominator: nsmDen, rate: nsmDen ? nsmNum / nsmDen : 0,
      definition: "Users who completed intake, explored the field (opened a new path, took the nudge, or compared 2+ options), and saved a shortlist of 2+ ÷ everyone who entered.",
    },
    funnel: { entered: totalUsers, completedIntake, exploredUnconsidered, savedShortlist },
    engagement: { reflections, chats, shortlistItems, usersWithShortlist },
    feedback: { up, down, helpfulnessRate: rated ? up / rated : 0, rated },
    voice: { total: feedbackTotal, open: feedbackOpen, topThemes, sentiment },
    guardrail: { distressFlags: distress },
    chatsByPersona,
    generatedAt: new Date().toISOString(),
  });
}));

// ---- admin: feedback triage inbox ----
app.get("/api/admin/feedback", adminAuth, h(async (req, res) => {
  const status = String(req.query.status || "");
  const rows = status
    ? await all("SELECT * FROM feedback WHERE status=? ORDER BY created_at DESC LIMIT 200", [status])
    : await all("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 200");
  res.json({ feedback: rows });
}));
app.post("/api/admin/feedback/:id", adminAuth, h(async (req, res) => {
  const { status } = req.body || {};
  if (!["new", "triaged", "actioned", "dismissed"].includes(status)) return res.status(400).json({ error: "bad_status" });
  await run(SQL.setFeedbackStatus, [status, req.params.id]);
  res.json({ ok: true });
}));

// ---- serve the built front-end (single service, same origin as /api) ----
const WEB_DIST = process.env.WEB_DIST || join(HERE, "..", "..", "web", "dist");
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(WEB_DIST, "index.html")));
  console.log(`Serving front-end from ${WEB_DIST}`);
} else if (IS_PROD) {
  console.warn(`⚠️  WEB_DIST not found at ${WEB_DIST} — front-end will not be served. Run the web build first.`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("ROUTE ERROR:", err?.stack || err);
  res.status(500).json({ error: "server_error", message: String(err?.message || err) });
});

const PORT = Number(process.env.PORT) || 5175;
await initDb(); // create the schema before accepting requests
app.listen(PORT, () => console.log(`Marg API on http://localhost:${PORT}  (store: ${IS_TURSO ? "Turso" : "sqlite file"}, AI key: ${hasKey})`));
