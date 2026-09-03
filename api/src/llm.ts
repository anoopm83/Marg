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

const REFLECT_SYSTEM = [
  "You are Marg, a calm, non-judgmental guide for an Indian Class 10 student (Bengaluru, CBSE) choosing what to do after Class 10.",
  "You are given ONE option's verified data and the student's self-described interests and values.",
  "Write a short, warm reflection connecting THIS option to what the student told you.",
  "HARD RULES: Never issue a verdict or tell them what to choose — you rate the OPTION's fit, never the child.",
  "Use ONLY the provided option data; never invent colleges, fees, schemes or facts. Growth-framed: interests can change.",
  "If the option is not an obvious match, frame exploring it positively.",
  'Return ONLY JSON: {"band": "Worth exploring"|"Strong fit"|"A stretch", "why_this_connects": string (<=2 sentences), "what_to_watch": string (1 sentence), "confidence": "low"|"medium"|"high"}. No markdown, no prose outside the JSON.',
].join("\n");

const PLAN_SYSTEM = [
  "You are Marg, a calm, non-judgmental guide for an Indian Class 10 student (Bengaluru, CBSE).",
  "The student named an ambition. You are given that pathway's verified data and the student's interests and values.",
  "Write a short, warm framing for pursuing this ambition — never a plan to commit to. An ambition at this age can and should stay open.",
  "Use ONLY the provided pathway data; invent nothing.",
  'Return ONLY JSON: {"opening": string (1 sentence, "a possible path"), "reconciliation": string (1-2 sentences; if the student\'s interests diverge from what this path needs, name that trade-off kindly and point to keeping options open, else gently encourage the adjacent paths too), "watch": string (1 honest sentence on effort/cost, remembering there are routes through it), "confidence": "low"|"medium"|"high"}. No markdown, no prose outside the JSON.',
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
export async function reflect(profile: any, option: any) {
  const payload = {
    student: { interests: profile?.interests ?? [], values: profile?.values ?? [] },
    option: { name: option.name, summary: option.summary, leads_to: option.leads_to, keeps_open: option.keeps_open, honest_notes: option.honest_notes },
  };
  return complete(REFLECT_SYSTEM, payload, reflectGeminiSchema, ReflectionSchema);
}

export async function planReflect(profile: any, pathway: any) {
  const payload = {
    student: { interests: profile?.interests ?? [], values: profile?.values ?? [] },
    pathway: {
      ambition: pathway.ambition, next_horizon_steps: pathway.next_horizon_steps,
      honest_cost_effort: pathway.honest_cost_effort, real_routes_through_cost: pathway.real_routes_through_cost,
      adjacent_destinations: pathway.adjacent_destinations, what_if_it_changes: pathway.what_if_it_changes,
    },
  };
  return complete(PLAN_SYSTEM, payload, planGeminiSchema, PlanSchema);
}
