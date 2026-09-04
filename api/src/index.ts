import "dotenv/config";
import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { auth, id, now, hash, verify, newToken, type AuthedRequest } from "./auth.js";
import { options } from "./dataset.js";
import { getPack, getConfig, personaList } from "./personas.js";
import { reflect, planReflect, chat, type ChatMsg, MODEL, hasKey, PROVIDER } from "./llm.js";
import { checkDistress, HELPLINES } from "./safety.js";

const app = express();
app.use(cors());
app.use(express.json());

// ---- prepared statements ----
const insUser = db.prepare("INSERT INTO users (id, user_handle, password_hash, email, is_minor, created_at) VALUES (?,?,?,?,?,?)");
const getUserByHandle = db.prepare("SELECT * FROM users WHERE user_handle = ?");
const insConsent = db.prepare("INSERT INTO consent (id, user_id, path, parental_status, school_code, consented_at) VALUES (?,?,?,?,?,?)");
const insSession = db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)");
const delSession = db.prepare("DELETE FROM sessions WHERE token = ?");
const upsertIntake = db.prepare("INSERT INTO intake (user_id, data, updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at");
const getIntake = db.prepare("SELECT data FROM intake WHERE user_id = ?");
const getShortlist = db.prepare("SELECT option_id, note, added_at FROM shortlist_items WHERE user_id = ? ORDER BY added_at");
const hasShortlistItem = db.prepare("SELECT id FROM shortlist_items WHERE user_id = ? AND option_id = ?");
const insShortlist = db.prepare("INSERT INTO shortlist_items (id, user_id, option_id, note, added_at) VALUES (?,?,?,?,?)");
const delShortlist = db.prepare("DELETE FROM shortlist_items WHERE user_id = ? AND option_id = ?");
const insEvent = db.prepare("INSERT INTO events (id, user_id, name, props, ts) VALUES (?,?,?,?,?)");
const delUserCascade = db.prepare("DELETE FROM users WHERE id = ?");

function logEvent(userId: string | null, name: string, props: any) {
  try { insEvent.run(id(), userId, name, props ? JSON.stringify(props) : null, now()); } catch { /* non-fatal */ }
}

// ---- health & content ----
app.get("/api/health", (_req, res) => res.json({ ok: true, provider: PROVIDER, model: MODEL, ai_key_detected: hasKey, options: options.length }));
// Persona registry for the picker (config only, no data pack).
app.get("/api/personas", (_req, res) => res.json({ personas: personaList }));
app.get("/api/options", (req, res) => {
  const pack = getPack(req.query.persona); // unknown/absent → class10 (default + fallback)
  res.json({ options: pack.options, scholarships: pack.scholarships, pathways: pack.pathways, specialized: pack.specializedPathways });
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
app.post("/api/register", (req, res) => {
  const { userId, password, email, consent } = req.body || {};
  if (!userId || typeof userId !== "string" || userId.length < 3) return res.status(400).json({ error: "bad_user_id" });
  if (!password || typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "weak_password" });
  if (!consent || !["self_serve", "school_mediated"].includes(consent.path)) return res.status(400).json({ error: "consent_required" });
  if (getUserByHandle.get(userId)) return res.status(409).json({ error: "handle_taken" });

  const uid = id();
  insUser.run(uid, userId, hash(password), email || null, 1, now());
  // Prototype consent: recorded as verified for the chosen path. Production needs
  // real verifiable parental consent (DPDP) before this can be "verified".
  insConsent.run(id(), uid, consent.path, "verified", consent.school_code || null, now());
  const token = newToken();
  insSession.run(token, uid, now());
  logEvent(uid, "account_created", { path: consent.path });
  return res.json({ token, userId });
});

app.post("/api/login", (req, res) => {
  const { userId, password } = req.body || {};
  const u = getUserByHandle.get(userId) as any;
  if (!u || !verify(password || "", u.password_hash)) return res.status(401).json({ error: "invalid_credentials" });
  const token = newToken();
  insSession.run(token, u.id, now());
  return res.json({ token, userId: u.user_handle });
});

app.post("/api/logout", auth, (req: AuthedRequest, res) => {
  const header = req.header("authorization") || "";
  delSession.run(header.replace(/^Bearer\s+/i, ""));
  res.json({ ok: true });
});

// ---- intake ----
app.get("/api/intake", auth, (req: AuthedRequest, res) => {
  const row = getIntake.get(req.userId!) as { data: string } | undefined;
  res.json({ intake: row ? JSON.parse(row.data) : null });
});
app.post("/api/intake", auth, (req: AuthedRequest, res) => {
  const data = req.body || {};
  upsertIntake.run(req.userId!, JSON.stringify(data), now());
  logEvent(req.userId!, "intake_completed", { fields: Object.keys(data).length });
  res.json({ ok: true });
});

// ---- reflections (grounded Claude) ----
app.post("/api/reflect", auth, async (req: AuthedRequest, res) => {
  const { optionId, persona } = req.body || {};
  const option = getPack(persona).optById.get(optionId);
  if (!option) return res.status(400).json({ error: "unknown_option" });
  if (!hasKey) return res.status(503).json({ error: "no_ai_key", message: `No key for LLM_PROVIDER='${PROVIDER}'. Set it in api/.env (see api/.env.example) to enable live reflections.` });
  const row = getIntake.get(req.userId!) as { data: string } | undefined;
  const profile = row ? JSON.parse(row.data) : {};
  try {
    const reflection = await reflect(profile, option, getConfig(persona).audience);
    logEvent(req.userId!, "option_reflected", { option_id: optionId });
    res.json({ source: PROVIDER, model: MODEL, reflection });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: "reflect_failed", message: String(e?.message || e) });
  }
});

app.post("/api/plan", auth, async (req: AuthedRequest, res) => {
  const { pathwayId, persona } = req.body || {};
  const pathway = getPack(persona).pathById.get(pathwayId);
  if (!pathway) return res.status(400).json({ error: "unknown_pathway" });
  if (!hasKey) return res.status(503).json({ error: "no_ai_key", message: `No key for LLM_PROVIDER='${PROVIDER}'. Set it in api/.env (see api/.env.example) to enable live reflections.` });
  const row = getIntake.get(req.userId!) as { data: string } | undefined;
  const profile = row ? JSON.parse(row.data) : {};
  try {
    const plan = await planReflect(profile, pathway, getConfig(persona).audience);
    res.json({ source: PROVIDER, model: MODEL, plan });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: "plan_failed", message: String(e?.message || e) });
  }
});

// ---- conversational chat (grounded, no-verdict; safety-gated) ----
app.post("/api/chat", auth, async (req: AuthedRequest, res) => {
  const { mode, contextId, goal, messages, persona } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "no_messages" });

  // SAFETY GATE — server-side, before any LLM call. Scan the latest user turn.
  // Helplines are persona-appropriate (config-driven), falling back to the default set.
  const lastUser = [...messages].reverse().find((m: any) => m?.role === "user");
  if (lastUser && checkDistress(String(lastUser.content || ""))) {
    logEvent(req.userId!, "distress_flag_raised", { source: "chat", mode, persona });
    return res.json({ safety: true, helplines: getConfig(persona).helplines || HELPLINES });
  }

  if (!hasKey) return res.status(503).json({ error: "no_ai_key", message: `No key for LLM_PROVIDER='${PROVIDER}'. Set it in api/.env to enable chat.` });

  const pack = getPack(persona);
  const row = getIntake.get(req.userId!) as { data: string } | undefined;
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
    const reply = await chat(groundCtx, history, getConfig(persona).audience);
    logEvent(req.userId!, "chat_message", { mode, turns: history.length });
    res.json({ source: PROVIDER, model: MODEL, reply });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: "chat_failed", message: String(e?.message || e) });
  }
});

// ---- shortlist ----
app.get("/api/shortlist", auth, (req: AuthedRequest, res) => {
  res.json({ shortlist: getShortlist.all(req.userId!) });
});
app.post("/api/shortlist", auth, (req: AuthedRequest, res) => {
  const { optionId, note, persona } = req.body || {};
  if (!getPack(persona).optById.get(optionId)) return res.status(400).json({ error: "unknown_option" });
  if (!hasShortlistItem.get(req.userId!, optionId)) {
    insShortlist.run(id(), req.userId!, optionId, note || null, now());
    logEvent(req.userId!, "shortlist_saved", { option_id: optionId });
  }
  res.json({ shortlist: getShortlist.all(req.userId!) });
});
app.delete("/api/shortlist/:optionId", auth, (req: AuthedRequest, res) => {
  delShortlist.run(req.userId!, req.params.optionId);
  res.json({ shortlist: getShortlist.all(req.userId!) });
});

// ---- DPDP: delete everything ----
app.delete("/api/me", auth, (req: AuthedRequest, res) => {
  delUserCascade.run(req.userId!); // cascades to consent/intake/shortlist/sessions
  res.json({ ok: true });
});

app.post("/api/event", auth, (req: AuthedRequest, res) => {
  const { name, props } = req.body || {};
  if (name) logEvent(req.userId!, String(name), props);
  res.json({ ok: true });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("ROUTE ERROR:", err?.stack || err);
  res.status(500).json({ error: "server_error", message: String(err?.message || err) });
});

const PORT = Number(process.env.PORT) || 5175;
app.listen(PORT, () => console.log(`Marg API on http://localhost:${PORT}  (AI key detected: ${hasKey})`));
