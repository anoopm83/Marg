// Provider-agnostic grounded reflection layer.
// Pick a provider with LLM_PROVIDER (groq | gemini | anthropic | openai | ollama).
// The output SHAPE and safety rules are enforced here (Zod validation + system
// prompt) regardless of provider, so "never a verdict / no fabrication" holds
// everywhere. Groq/OpenAI/Ollama share the OpenAI-compatible path.
import { z } from "zod";

export const PROVIDER = (process.env.LLM_PROVIDER || "groq").toLowerCase();

const MODELS: Record<string, string> = {
  groq: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
  ollama: process.env.OLLAMA_MODEL || "llama3.1",
  gemini: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  anthropic: process.env.ANTHROPIC_MODEL || "claude-opus-5",
};
export const MODEL = MODELS[PROVIDER] || MODELS.groq;

export function providerReady(): boolean {
  switch (PROVIDER) {
    case "ollama": return true; // local, no key
    case "gemini": return !!process.env.GEMINI_API_KEY;
    case "anthropic": return !!process.env.ANTHROPIC_API_KEY || !!process.env.ANTHROPIC_AUTH_TOKEN;
    case "openai": return !!process.env.OPENAI_API_KEY;
    case "groq": default: return !!process.env.GROQ_API_KEY;
  }
}
export const hasKey = providerReady();

// ---- schemas (Zod validates every provider's output) ----
const ReflectionSchema = z.object({
  band: z.enum(["Worth exploring", "Strong fit", "A stretch"]),
  why_this_connects: z.string(),
  what_to_watch: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});
const PlanSchema = z.object({
  opening: z.string(),
  reconciliation: z.string(),
  watch: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

// Gemini responseSchema (OpenAPI subset)
const reflectGeminiSchema = {
  type: "object",
  properties: {
    band: { type: "string", enum: ["Worth exploring", "Strong fit", "A stretch"] },
    why_this_connects: { type: "string" },
    what_to_watch: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["band", "why_this_connects", "what_to_watch", "confidence"],
};
const planGeminiSchema = {
  type: "object",
  properties: {
    opening: { type: "string" },
    reconciliation: { type: "string" },
    watch: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["opening", "reconciliation", "watch", "confidence"],
};

const DEFAULT_AUDIENCE = "an Indian Class 10 student (Bengaluru, CBSE) choosing what to do after Class 10";

const reflectSystem = (audience: string) => [
  `You are Marg, a calm, non-judgmental guide for ${audience}.`,
  "You are given ONE option's data and the person's self-described interests and values.",
  "Write a short, warm reflection connecting THIS option to what they told you.",
  "HARD RULES: Never issue a verdict or tell them what to choose — you rate the OPTION's fit, never the person.",
  "Use ONLY the provided option data; never invent colleges, fees, schemes or facts. Growth-framed: interests can change.",
  "If the option is not an obvious match, frame exploring it positively.",
  'Return ONLY JSON: {"band": "Worth exploring"|"Strong fit"|"A stretch", "why_this_connects": string (<=2 sentences), "what_to_watch": string (1 sentence), "confidence": "low"|"medium"|"high"}. No markdown, no prose outside the JSON.',
].join("\n");

const planSystem = (audience: string) => [
  `You are Marg, a calm, non-judgmental guide for ${audience}.`,
  "The person named an ambition. You are given that pathway's data and their interests and values.",
  "Write a short, warm framing for pursuing this ambition — never a plan to commit to. An ambition can and should stay open.",
  "Use ONLY the provided pathway data; invent nothing.",
  'Return ONLY JSON: {"opening": string (1 sentence, "a possible path"), "reconciliation": string (1-2 sentences; if their interests diverge from what this path needs, name that trade-off kindly and point to keeping options open, else gently encourage the adjacent paths too), "watch": string (1 honest sentence on effort/cost, remembering there are routes through it), "confidence": "low"|"medium"|"high"}. No markdown, no prose outside the JSON.',
].join("\n");

// ---- provider adapters ----
const OPENAI_COMPAT: Record<string, { base: string; key?: string }> = {
  groq: { base: "https://api.groq.com/openai/v1", key: process.env.GROQ_API_KEY },
  openai: { base: "https://api.openai.com/v1", key: process.env.OPENAI_API_KEY },
  ollama: { base: process.env.OLLAMA_BASE || "http://localhost:11434/v1", key: undefined },
};

// Shared OpenAI-compatible POST with 429 backoff. Groq's free tier is a rolling
// tokens-per-minute limit that resets in ~seconds, and the 429 body tells us how
// long to wait ("try again in Xs") — so honour it and retry rather than failing.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function openaiPost(body: object): Promise<any> {
  const cfg = OPENAI_COMPAT[PROVIDER];
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(cfg.base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cfg.key ? { Authorization: "Bearer " + cfg.key } : {}) },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.json();
    const text = await r.text();
    if (r.status === 429 && attempt < 2) {
      const header = Number(r.headers.get("retry-after")); // seconds, if present
      const m = text.match(/try again in ([\d.]+)\s*s/i);
      const waitMs = Math.min((header ? header : m ? parseFloat(m[1]) : 1.5) * 1000 + 250, 8000);
      await sleep(waitMs);
      continue;
    }
    throw new Error(`LLM ${r.status}: ${text.slice(0, 300)}`);
  }
  throw new Error("LLM: rate-limit retries exhausted");
}

async function callOpenAICompat(system: string, user: string): Promise<string> {
  const d = await openaiPost({
    model: MODEL,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 400,
  });
  return d.choices?.[0]?.message?.content ?? "";
}

async function callGemini(system: string, user: string, schema: unknown): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d: any = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    messages: [{ role: "user", content: user }],
  });
  return resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON found in model output");
  return m[0];
}

async function complete<T>(system: string, userObj: unknown, geminiSchema: unknown, schema: z.ZodType<T>): Promise<T> {
  const user = JSON.stringify(userObj);
  // Reasoning models (e.g. Groq gpt-oss) intermittently emit reasoning tokens that
  // break the json_object constraint → a stochastic HTTP 400 (~1 in 3). It succeeds
  // on retry, so try a few times before surfacing the error. (Prose chat is unaffected.)
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let raw: string;
      if (PROVIDER === "gemini") raw = await callGemini(system, user, geminiSchema);
      else if (PROVIDER === "anthropic") raw = await callAnthropic(system, user);
      else raw = await callOpenAICompat(system, user); // groq | openai | ollama
      return schema.parse(JSON.parse(extractJson(raw)));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ---- public API (same signatures the routes already use) ----
export async function reflect(profile: any, option: any, audience: string = DEFAULT_AUDIENCE) {
  const payload = {
    student: { interests: profile?.interests ?? [], values: profile?.values ?? [] },
    option: { name: option.name, summary: option.summary, leads_to: option.leads_to, keeps_open: option.keeps_open, honest_notes: option.honest_notes },
  };
  return complete(reflectSystem(audience), payload, reflectGeminiSchema, ReflectionSchema);
}

export async function planReflect(profile: any, pathway: any, audience: string = DEFAULT_AUDIENCE) {
  const payload = {
    student: { interests: profile?.interests ?? [], values: profile?.values ?? [] },
    pathway: {
      ambition: pathway.ambition, next_horizon_steps: pathway.next_horizon_steps,
      honest_cost_effort: pathway.honest_cost_effort, real_routes_through_cost: pathway.real_routes_through_cost,
      adjacent_destinations: pathway.adjacent_destinations, what_if_it_changes: pathway.what_if_it_changes,
    },
  };
  return complete(planSystem(audience), payload, planGeminiSchema, PlanSchema);
}

// ---- conversational chat (Mode A "ask about a stream" / Mode B "type a goal") ----
// Full chat is prose, so the structured-output verdict lock does not apply here —
// no-verdict + no-invention are enforced by this system prompt and by grounding
// every turn on the curated catalogue ONLY. (Distress is caught server-side before
// this is ever called.) This is weaker than the structured path and must be
// adversarially tested before real students (Architecture §8).
export type ChatMsg = { role: "user" | "assistant"; content: string };

const chatSystem = (audience: string, allowGeneral: boolean) => {
  const rules = [
    `You are Marg, a warm, calm, non-judgmental guide for ${audience}. You are in a short conversation with them.`,
    "You are given their self-described interests and values, what they are currently looking at (an option they are exploring, or a goal they typed), and the curated catalogue of options, specialized pathways, ambition-pathways and scholarships.",
    "HARD RULES — follow every time:",
    "1. NEVER tell them what to choose, never rank options, never call one 'best' or 'better'. You help them see and weigh options; the decision is always theirs.",
  ];
  if (allowGeneral) {
    rules.push(
      "2. Prefer the supplied catalogue. If they ask about a goal or topic NOT in it, you MAY draw on your own general knowledge to be genuinely helpful — explain what it broadly involves and how a person typically pursues it, and connect it to the nearest real pathways in the catalogue. But do NOT present specific institutions, fees, cutoffs, deadlines or links as established fact — keep those general and tell them to confirm with official sources.",
      "3. WHENEVER you draw on general knowledge beyond the catalogue, you MUST end that reply with this exact line on its own: 'Beta note: This is only general knowledge here and not validated facts — please double-check these details, as they're not yet from Marg's verified data.'",
    );
  } else {
    rules.push(
      "2. Use ONLY facts from the supplied catalogue — it is your ONLY source of facts. NEVER invent an institution, fee, cutoff, scholarship, deadline or link. If they ask something not in the catalogue, say plainly you don't have verified information on that and point them to the relevant official source. Do not guess.",
      "3. Every figure in the catalogue is provisional — present figures as approximate ('roughly', 'around', 'please double-check'), never as a guarantee. If a typed goal has no catalogue match, say so honestly and point to the nearest real pathway present — never fabricate a path.",
    );
  }
  rules.push(
    "4. Growth-framed: interests and circumstances can change. Never label the person.",
    "5. Keep replies SHORT: 2-5 sentences, plain language, kind. End with a gentle question or a concrete next step when it helps.",
    "6. Stay on the topic of options and next steps for their situation. If asked something off-topic, gently steer back. You are not a crisis counsellor.",
  );
  return rules.join("\n");
};

function groundingBlock(ctx: any): string {
  return "GROUNDING (facts you may use — nothing beyond this):\n" + JSON.stringify(ctx);
}

async function chatOpenAICompat(system: string, messages: ChatMsg[]): Promise<string> {
  const d = await openaiPost({
    model: MODEL,
    messages: [{ role: "system", content: system }, ...messages],
    temperature: 0.5,
    max_tokens: 550,
  });
  const m = d.choices?.[0]?.message;
  return (m?.content || m?.reasoning || "") ?? ""; // some reasoning models leave content empty
}

async function chatAnthropic(system: string, messages: ChatMsg[]): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: MODEL, max_tokens: 700, system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

async function chatGemini(system: string, messages: ChatMsg[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.5, maxOutputTokens: 700 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d: any = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function chat(groundCtx: any, messages: ChatMsg[], audience: string = DEFAULT_AUDIENCE, allowGeneral = false): Promise<string> {
  const system = chatSystem(audience, allowGeneral) + "\n\n" + groundingBlock(groundCtx);
  let raw: string;
  if (PROVIDER === "gemini") raw = await chatGemini(system, messages);
  else if (PROVIDER === "anthropic") raw = await chatAnthropic(system, messages);
  else raw = await chatOpenAICompat(system, messages); // groq | openai | ollama
  return raw.trim();
}

// ---- feedback interpreter (triage only, never an action) ----
// Marg reads a free-text "how can we improve" note and classifies it so an admin
// can triage fast. It DRAFTS a suggested action — it does NOT (and must not) apply
// anything: the founding rule ("the LLM never authors a fact") means data/product
// changes stay a human decision. Best-effort: callers must tolerate a null result.
export interface FeedbackInsight {
  theme: string; sentiment: "positive" | "neutral" | "negative";
  severity: "low" | "medium" | "high"; summary: string; suggestion: string;
}
const FeedbackSchema = z.object({
  theme: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  severity: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  suggestion: z.string(),
});
const feedbackGeminiSchema = {
  type: "object",
  properties: {
    theme: { type: "string" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    summary: { type: "string" },
    suggestion: { type: "string" },
  },
  required: ["theme", "sentiment", "severity", "summary", "suggestion"],
};
const feedbackSystem = [
  "You are the product-triage assistant for Marg, an AI guide that helps people at life's crossroads choose a path.",
  "You are given ONE piece of free-text user feedback plus light context (which persona, where in the app, any category the user picked).",
  "Classify it for a human product admin. Do NOT reply to the user and do NOT propose changing any factual data yourself.",
  "theme: a short 2-4 word product-area label (e.g. 'Data accuracy', 'Missing option', 'Confusing UI', 'Chat quality', 'Praise', 'Tone').",
  "sentiment: positive | neutral | negative.",
  "severity: how much this hurts the user's decision — high (blocks/misleads), medium (friction), low (nice-to-have/praise).",
  "summary: one neutral sentence restating the point.",
  "suggestion: ONE concrete next step FOR THE ADMIN to consider (e.g. 'Verify the polytechnic fee figure against DTE Karnataka'). Frame it as a recommendation to a human, never as done.",
  'Return ONLY JSON: {"theme": string, "sentiment": "positive"|"neutral"|"negative", "severity": "low"|"medium"|"high", "summary": string, "suggestion": string}. No markdown.',
].join("\n");

export async function interpretFeedback(text: string, context: Record<string, unknown>): Promise<FeedbackInsight | null> {
  if (!hasKey) return null;
  try {
    return await complete(feedbackSystem, { feedback: text, context }, feedbackGeminiSchema, FeedbackSchema);
  } catch {
    return null; // triage is best-effort; the raw note is still saved and visible to the admin
  }
}
