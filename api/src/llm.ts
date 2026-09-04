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

async function callOpenAICompat(system: string, user: string): Promise<string> {
  const cfg = OPENAI_COMPAT[PROVIDER];
  const r = await fetch(cfg.base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cfg.key ? { Authorization: "Bearer " + cfg.key } : {}) },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 400,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d: any = await r.json();
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
  let raw: string;
  if (PROVIDER === "gemini") raw = await callGemini(system, user, geminiSchema);
  else if (PROVIDER === "anthropic") raw = await callAnthropic(system, user);
  else raw = await callOpenAICompat(system, user); // groq | openai | ollama
  return schema.parse(JSON.parse(extractJson(raw)));
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

const chatSystem = (audience: string) => [
  `You are Marg, a warm, calm, non-judgmental guide for ${audience}. You are in a short conversation with them.`,
  "You are given their self-described interests and values, what they are currently looking at (an option they are exploring, or a goal they typed), and the FULL curated catalogue of options, specialized pathways, ambition-pathways and scholarships. That catalogue is your ONLY source of facts.",
  "HARD RULES — follow every time:",
  "1. NEVER tell them what to choose, never rank options, never call one 'best' or 'better'. You help them see and weigh options; the decision is always theirs.",
  "2. Use ONLY facts from the supplied catalogue. NEVER invent an institution, fee, cutoff, scholarship, deadline or link. If they ask something not in the catalogue, say plainly you don't have verified information on that and point them to the relevant official source. Do not guess.",
  "3. This is an MVP: EVERY figure in the catalogue is provisional and unverified. Present all figures as approximate ('roughly', 'around', 'please double-check'), never as a guarantee, and encourage confirming against the official source.",
  "4. Growth-framed: interests and circumstances can change. Never label the person.",
  "5. If a typed goal has no exact match in the catalogue, say so honestly, point to the nearest real pathway(s) present, and note there may be more than one route — never fabricate a path.",
  "6. Keep replies SHORT: 2-4 sentences, plain language, kind. End with a gentle question or a concrete next step when it helps.",
  "7. Stay on the topic of options and next steps for their situation. If asked something off-topic, gently steer back. You are not a crisis counsellor.",
].join("\n");

function groundingBlock(ctx: any): string {
  return "GROUNDING (facts you may use — nothing beyond this):\n" + JSON.stringify(ctx);
}

async function chatOpenAICompat(system: string, messages: ChatMsg[]): Promise<string> {
  const cfg = OPENAI_COMPAT[PROVIDER];
  const r = await fetch(cfg.base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cfg.key ? { Authorization: "Bearer " + cfg.key } : {}) },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.5,
      max_tokens: 320,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d: any = await r.json();
  return d.choices?.[0]?.message?.content ?? "";
}

async function chatAnthropic(system: string, messages: ChatMsg[]): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: MODEL, max_tokens: 320, system,
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
      generationConfig: { temperature: 0.5, maxOutputTokens: 320 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d: any = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function chat(groundCtx: any, messages: ChatMsg[], audience: string = DEFAULT_AUDIENCE): Promise<string> {
  const system = chatSystem(audience) + "\n\n" + groundingBlock(groundCtx);
  let raw: string;
  if (PROVIDER === "gemini") raw = await chatGemini(system, messages);
  else if (PROVIDER === "anthropic") raw = await chatAnthropic(system, messages);
  else raw = await chatOpenAICompat(system, messages); // groq | openai | ollama
  return raw.trim();
}
