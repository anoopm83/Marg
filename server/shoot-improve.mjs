import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = "C:/Users/anoop/portfolio/MargAI/screenshots-app";
const BASE = "http://localhost:5174";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.setViewport({ width: 430, height: 940, deviceScaleFactor: 2 });
async function clickText(t, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const ok = await page.evaluate((t) => {
      const els = [...document.querySelectorAll("button,a")];
      const el = els.find((e) => e.textContent && e.textContent.replace(/\s+/g, " ").trim().includes(t));
      if (el) { el.click(); return true; } return false;
    }, t);
    if (ok) return true; await sleep(200);
  }
  return false;
}
const has = (t) => page.evaluate((t) => document.body.innerText.replace(/\s+/g, " ").includes(t), t);

try {
  // ---- ADMIN DASHBOARD (data already seeded via API) ----
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" }); await sleep(500);
  await clickText("Admin"); await sleep(600);
  const ins = await page.$$("input");
  if (ins[1]) { await ins[1].type("admin"); } // password (userId prefilled)
  await clickText("Sign in") || await clickText("Log in") || await clickText("Enter");
  await sleep(1500);
  console.log("admin loaded, has VOICE:", await has("VOICE OF THE USER"), "| has North Star:", await has("NORTH STAR"));
  await page.screenshot({ path: `${OUT}/47-admin-voice.png`, fullPage: true });
  console.log("shot 47-admin-voice");

  // ---- IMPROVE-MARG MODAL (guest flow) ----
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" }); await sleep(500);
  await clickText("Class 10"); await sleep(500);
  await clickText("Start") || await clickText("Get started") || await clickText("Begin"); await sleep(500);
  // consent (minor)
  await clickText("parent") || await clickText("guardian") || await clickText("Continue"); await sleep(800);
  await clickText("Continue"); await sleep(800);
  // reach explore, then a terminal screen (shortlist) that carries the footer link
  await clickText("not sure") || await clickText("Explore"); await sleep(1400);
  await clickText("View my shortlist"); await sleep(900);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(500);
  const opened = await clickText("Suggest an improvement", 6000);
  await sleep(700);
  if (opened) {
    await clickText("Wrong or outdated info"); await sleep(200);
    const ta = await page.$("textarea");
    if (ta) await ta.type("The polytechnic fees look out of date, and hotel management is missing.");
    await sleep(400);
  }
  console.log("improve modal open:", await has("Help make Marg better"));
  await page.screenshot({ path: `${OUT}/48-improve-marg.png`, fullPage: true });
  console.log("shot 48-improve-marg");
  console.log("DONE");
} catch (e) {
  console.error("FAILED:", e.message);
  try { await page.screenshot({ path: `${OUT}/99-improve-fail.png` }); console.log("STATE:", (await page.evaluate(() => document.body.innerText.slice(0, 400))).replace(/\s+/g, " ")); } catch {}
} finally { await browser.close(); }
