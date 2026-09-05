import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = "C:/Users/anoop/portfolio/MargAI/screenshots-app";
const BASE = "http://localhost:5174";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 940, deviceScaleFactor: 1 });

const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") { const t = m.text(); if (!/favicon|404|Failed to load resource/.test(t)) errors.push("CONSOLE: " + t.slice(0, 140)); } });

const results = [];
const pass = (n) => { results.push("  PASS " + n); };
const fail = (n, d = "") => { results.push("  FAIL " + n + (d ? " — " + d : "")); };
const ct = async (t, ms = 9000) => { const e = Date.now() + ms; while (Date.now() < e) { const ok = await page.evaluate((t) => { const el = [...document.querySelectorAll("button,a")].find(e => e.textContent && e.textContent.replace(/\s+/g, " ").includes(t)); if (el) { el.click(); return true; } return false; }, t); if (ok) return true; await sleep(150); } return false; };
const has = (t) => page.evaluate((t) => document.body.innerText.replace(/\s+/g, " ").includes(t), t);
const clickChips = async (n) => page.evaluate((n) => { const c = [...document.querySelectorAll(".chip")].filter(x => !/Skip/.test(x.textContent)); for (let i = 0; i < Math.min(n, c.length); i++) c[i].click(); return c.length; }, n);
const reset = async () => { await page.goto(BASE, { waitUntil: "networkidle2" }); await page.evaluate(() => { try { localStorage.clear(); } catch {} }); await page.goto(BASE, { waitUntil: "networkidle2" }); await sleep(500); };

async function runPersona(label, stageText, isMinor) {
  results.push("");
  results.push("PERSONA: " + label);
  await reset();
  // enter via journey stage (openStage -> welcome)
  if (!await ct(stageText)) { fail("open stage '" + stageText + "'"); return; }
  await sleep(500);
  // welcome -> start
  if (!await ct("Start") && !await ct("Begin") && !await ct("Let")) fail("welcome start button");
  await sleep(500);
  if (isMinor) { await ct("parent") || await ct("guardian") || await ct("consent"); await sleep(600); }
  // intake
  if (await has("enjoy") || await has("about you") || await has("matters most")) pass("reached intake"); else fail("reached intake");
  const nchips = await clickChips(3); await sleep(200);
  if (nchips > 0) pass("intake chips present (" + nchips + ")"); else fail("intake chips present");
  if (!await ct("Continue")) fail("intake continue"); await sleep(800);
  // mode
  if (await has("Explore") || await has("not sure") || await has("goal")) pass("reached mode"); else fail("reached mode");
  await ct("not sure") || await ct("Explore your options") || await ct("Explore"); await sleep(1200);
  // explore
  if (await has("options") || await has("open to you") || await has("Your options")) pass("reached explore"); else fail("reached explore");
  // open first option detail
  const opened = await page.evaluate(() => { const o = document.querySelector(".opt,.stack button,.grid button"); if (o) { o.click(); return true; } return false; });
  await sleep(1500);
  if (opened && (await has("Eligibility") || await has("HOW TO READ") || await has("Duration"))) pass("option detail renders"); else fail("option detail renders");
  if (await has("OFFICIAL PORTALS")) pass("official links present"); else results.push("  NOTE " + label + ": no official links on this option");
}

try {
  // ---- Class 10 (minor) ----
  await runPersona("Class 10", "Class 10", true);
  // shortlist add on a core option
  await ct("Add to my shortlist"); await sleep(700);
  if (await has("In your shortlist") || await has("shortlist")) pass("shortlist add"); else fail("shortlist add");

  // ---- Mid-career ----
  await runPersona("Mid-career", "career", false);
  // ---- Retiree ----
  await runPersona("Retiree", "Later life", false);

  // ---- Cross-cutting ----
  results.push("");
  results.push("CROSS-CUTTING");
  await reset();
  // theme + font buttons exist and click without error
  const themeBtn = await page.evaluate(() => { const b = [...document.querySelectorAll(".a11y-btn")]; if (b.length >= 2) { b[b.length - 1].click(); return true; } return false; });
  await sleep(300); themeBtn ? pass("theme toggle clicks") : fail("theme toggle present");
  const fontBtn = await page.evaluate(() => { const b = [...document.querySelectorAll(".a11y-btn")]; if (b.length) { b[0].click(); return true; } return false; });
  await sleep(300); fontBtn ? pass("font toggle clicks") : fail("font toggle present");
  // logo present in top bar
  (await page.$(".ab-logo img")) ? pass("logo in top bar") : fail("logo in top bar");

  // ---- Admin ----
  results.push("");
  results.push("ADMIN");
  await reset();
  await ct("Admin"); await sleep(600);
  const ins = await page.$$("input");
  if (ins[1]) await ins[1].type("admin");
  await ct("Sign in") || await ct("Log in") || await ct("Enter"); await sleep(1500);
  if (await has("NORTH STAR")) pass("admin dashboard loads"); else fail("admin dashboard loads");
  if (await has("VOICE OF THE USER")) pass("voice-of-user section"); else fail("voice-of-user section");
} catch (e) {
  results.push("SCRIPT ERROR: " + e.message);
} finally {
  results.push("");
  results.push("=== CONSOLE / PAGE ERRORS: " + errors.length + " ===");
  errors.slice(0, 15).forEach((e) => results.push("  " + e));
  console.log(results.join("\n"));
  await browser.close();
}
