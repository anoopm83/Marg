// Populate a realistic demo cohort through the REAL API (no fabricated DB rows),
// so the admin dashboard / North Star look alive for a portfolio demo.
// Usage: SEED_BASE=https://your-app npm run seed   (server must be running)
const B = process.env.SEED_BASE || "http://127.0.0.1:5175";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pickN = (a, n) => { const c = [...a]; const o = []; for (let i = 0; i < n && c.length; i++) o.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return o; };
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

const CORE = ["pu_science", "pu_commerce", "pu_humanities", "polytechnic_diploma", "iti", "nios", "vocational"];
const SPEC = ["civil_services", "government_jobs", "forestry_environment", "arts_film_animation", "aviation_maritime", "paramedical_allied_health", "defence_forces", "sports_academy"];
const INTERESTS = ["Numbers", "Building things", "Biology", "Helping people", "Making & art", "Business"];
const VALUES = ["A steady income", "Doing work I love", "Helping my family soon", "Making an impact"];
const NOTES = [
  "Loved seeing options I never knew about, the polytechnic route was new to me.",
  "The fee numbers for private PU looked a bit outdated, please double-check.",
  "Wish there was more on commerce careers beyond CA.",
  "Really calm and helpful, didn't feel pushed toward anything.",
  "Could you add more government job exam dates?",
  "Add merchant navy details for after 12th please.",
  "Very useful for my child's decision, thank you.",
  "The chat was a little slow to reply sometimes.",
];

async function post(path, body, token) {
  const r = await fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  return r.json().catch(() => null);
}

const N = 100;                                   // entered
const depthFor = (i) => (i < 68 ? 3 : i < 80 ? 2 : i < 88 ? 1 : 0); // full / explored / intake / entered
console.log(`Seeding ${N} demo sessions against ${B} ...`);
let entered = 0, notes = 0;
for (let i = 0; i < N; i++) {
  const depth = depthFor(i);
  const reg = await post("/api/register", { userId: `sim_${Date.now().toString(36)}_${i}`, password: "sim-password", consent: { path: "self_serve" } });
  const t = reg?.token; if (!t) continue; entered++;
  if (depth >= 1) await post("/api/intake", { interests: pickN(INTERESTS, 2 + (i % 2)), values: pickN(VALUES, 1 + (i % 2)) }, t);
  if (depth >= 2) {
    for (const oid of pickN(CORE, 2 + Math.floor(Math.random() * 2))) { await post("/api/event", { name: "option_viewed", props: { option_id: oid, persona: "class10" } }, t); if (Math.random() < 0.7) await post("/api/event", { name: "option_reflected", props: { option_id: oid } }, t); }
    if (Math.random() < 0.45) await post("/api/event", { name: "specialized_viewed", props: { id: rnd(SPEC), persona: "class10" } }, t);
    else if (Math.random() < 0.4) await post("/api/event", { name: "nudge_engaged", props: { id: rnd(SPEC), persona: "class10" } }, t);
    if (Math.random() < 0.35) await post("/api/event", { name: "chat_message", props: { mode: "explore", turns: 2, persona: "class10" } }, t);
  }
  if (depth >= 3) for (const oid of pickN(CORE, 2 + (Math.random() < 0.4 ? 1 : 0))) await post("/api/shortlist", { optionId: oid, persona: "class10" }, t);
  if (depth >= 1) { const r = Math.random(); if (r < 0.62) await post("/api/event", { name: "feedback", props: { where: "session", rating: "up", persona: "class10" } }, t); else if (r < 0.70) await post("/api/event", { name: "feedback", props: { where: "session", rating: "down", persona: "class10" } }, t); }
  if (depth >= 2 && notes < NOTES.length && Math.random() < 0.12) { await post("/api/feedback", { text: NOTES[notes], category: rnd(["wrong_info", "missing", "confusing", "other"]), context: "explore", persona: "class10" }, t); notes++; await sleep(1500); }
}
console.log(`Done. Entered ${entered}, feedback notes ${notes}. Open /  → Admin (admin / your ADMIN_PASS) to see the dashboard.`);
