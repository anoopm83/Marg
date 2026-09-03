// Marg AI backend — serves the app and provides the grounded Claude reflection.
// The AI reflection is a SINGLE grounded LLM call with structured output that
// STRUCTURALLY cannot issue a verdict (fixed schema). It is given only ONE
// option's verified record + the student's self-described interests/values,
// and instructed to invent nothing beyond the supplied data.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(HERE, "..", "app");
const DATASET = path.join(HERE, "..", "marg-dataset-v0.json");
const PORT = process.env.PORT || 5173;
const MODEL = "claude-opus-5";

// A key is resolved from the environment by the SDK (ANTHROPIC_API_KEY / ant profile).
const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.ANTHROPIC_AUTH_TOKEN;
const client = new Anthropic(); // zero-arg: reads env credentials

const data = JSON.parse(await readFile(DATASET, "utf-8"));
const optById = Object.fromEntries(data.options.map((o) => [o.id, o]));
const pathById = Object.fromEntries(data.pathways.map((p) => [p.id, p]));

// Structured output — the model can only return one of three bands and short strings.
const ReflectionSchema = z.object({
  band: z.enum(["Worth exploring", "Strong fit", "A stretch"]),
  why_this_connects: z.string(),
  what_to_watch: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const SYSTEM = [
  "You are Marg, a calm, non-judgmental guide for an Indian Class 10 student (Bengaluru, CBSE) choosing what to do after Class 10.",
  "You are given ONE option's verified data and the student's self-described interests and values.",
  "Write a short, warm reflection connecting THIS option to what the student told you.",
  "HARD RULES:",
  "- Never issue a verdict or tell them what to choose. You rate the OPTION's fit, never the child.",
  "- Use ONLY the provided option data. Never invent colleges, fees, schemes, eligibility, or any fact.",
  "- Growth-framed: interests can change; nothing is permanent.",
  "- If the option is not an obvious match, frame exploring it positively (widening the field is good).",
  "- why_this_connects: at most 2 sentences. what_to_watch: exactly 1 sentence.",
].join("\n");

async function reflect(profile, option) {
  const userPayload = {
    student: { interests: profile.interests || [], values: profile.values || [] },
    option: {
      name: option.name,
      summary: option.summary,
      leads_to: option.leads_to,
      keeps_open: option.keeps_open,
      honest_notes: option.honest_notes,
    },
  };
  const resp = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    output_format: betaZodOutputFormat(ReflectionSchema),
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });
  if (!resp.parsed) throw new Error("reflection could not be parsed");
  return resp.parsed;
}

// Mode B — grounded framing for a stated ambition (never a verdict; reconciliation as a feature).
const PlanSchema = z.object({
  opening: z.string(),
  reconciliation: z.string(),
  watch: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const SYSTEM_PLAN = [
  "You are Marg, a calm, non-judgmental guide for an Indian Class 10 student (Bengaluru, CBSE).",
  "The student has named an ambition. You are given that pathway's verified data and the student's interests and values.",
  "Write a short, warm framing for pursuing this ambition — never a plan to commit to.",
  "HARD RULES:",
  "- Never tell them to commit. An ambition at this age can and should stay open.",
  "- Use ONLY the provided pathway data. Invent nothing (no exams, colleges, costs, or steps not given).",
  "- opening: one encouraging sentence framing this as 'a possible path'.",
  "- reconciliation: if the student's stated interests diverge from what this path needs, name that trade-off honestly and kindly and point them to keeping options open; otherwise gently encourage looking at the adjacent paths too. 1-2 sentences.",
  "- watch: one honest sentence about the effort/cost — remembering there are real routes through it.",
].join("\n");

async function planReflect(profile, pathway) {
  const userPayload = {
    student: { interests: profile.interests || [], values: profile.values || [] },
    pathway: {
      ambition: pathway.ambition,
      next_horizon_steps: pathway.next_horizon_steps,
      honest_cost_effort: pathway.honest_cost_effort,
      real_routes_through_cost: pathway.real_routes_through_cost,
      adjacent_destinations: pathway.adjacent_destinations,
      what_if_it_changes: pathway.what_if_it_changes,
    },
  };
  const resp = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PLAN,
    output_format: betaZodOutputFormat(PlanSchema),
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });
  if (!resp.parsed) throw new Error("plan reflection could not be parsed");
  return resp.parsed;
}

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  if (Buffer.isBuffer(body) || typeof body === "string") res.end(body);
  else res.end(JSON.stringify(body));
}

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

async function serveStatic(res, urlPath) {
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const safe = path.normalize(rel).replace(/^(\.\.[\/\\])+/, "");
  const full = path.join(APP_DIR, safe);
  if (!full.startsWith(APP_DIR)) return send(res, 403, "Forbidden", "text/plain");
  try {
    const buf = await readFile(full);
    send(res, 200, buf, MIME[path.extname(full)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found", "text/plain");
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") {
    return send(res, 200, { ok: true, model: MODEL, ai_key_detected: hasKey, options: data.options.length });
  }

  if (url.pathname === "/api/reflect" && req.method === "POST") {
    try {
      const { profile = {}, optionId } = await readBody(req);
      const option = optById[optionId];
      if (!option) return send(res, 400, { error: "unknown_option" });
      if (!hasKey) return send(res, 503, { error: "no_ai_key", message: "Set ANTHROPIC_API_KEY to enable live reflections." });
      const out = await reflect(profile, option);
      return send(res, 200, { source: "claude", model: MODEL, reflection: out });
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? (e.status || 502) : 500;
      return send(res, status, { error: "reflect_failed", message: String(e && e.message || e) });
    }
  }

  if (url.pathname === "/api/plan" && req.method === "POST") {
    try {
      const { profile = {}, pathwayId } = await readBody(req);
      const pathway = pathById[pathwayId];
      if (!pathway) return send(res, 400, { error: "unknown_pathway" });
      if (!hasKey) return send(res, 503, { error: "no_ai_key", message: "Set ANTHROPIC_API_KEY to enable live reflections." });
      const out = await planReflect(profile, pathway);
      return send(res, 200, { source: "claude", model: MODEL, plan: out });
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? (e.status || 502) : 500;
      return send(res, status, { error: "plan_failed", message: String(e && e.message || e) });
    }
  }

  if (req.method === "GET") return serveStatic(res, url.pathname);
  return send(res, 405, { error: "method_not_allowed" });
});

server.listen(PORT, () => {
  console.log(`Marg AI server on http://localhost:${PORT}  (AI key detected: ${hasKey})`);
});
