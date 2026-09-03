// Captures the Mode B (Aspire/Plan) flow, incl. the live Groq plan framing.
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
await page.setViewport({ width: 430, height: 920, deviceScaleFactor: 2 });
async function clickText(t, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const ok = await page.evaluate((t) => { const els = [...document.querySelectorAll("button,a")]; const el = els.find((e) => e.textContent && e.textContent.replace(/\s+/g, " ").includes(t)); if (el) { el.click(); return true; } return false; }, t);
    if (ok) return; await sleep(200);
  }
  throw new Error("timeout clicking: " + t);
}
async function shot(n, full = false) { await sleep(500); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full }); console.log("shot", n); }
try {
  await page.goto(BASE, { waitUntil: "networkidle2" }); await sleep(900);
  await clickText("Start");
  await clickText("My parent/guardian is here");
  const inputs = await page.$$("input.ta"); await inputs[0].type("modeb" + Date.now()); await inputs[1].type("secret123");
  await clickText("Create account"); await sleep(1000);
  await clickText("Biology"); await clickText("Making & art"); await sleep(200);
  await clickText("Continue"); await sleep(900);
  await clickText("I have a goal in mind"); await sleep(500); await shot("10-aspire");
  await clickText("Become a doctor"); await sleep(500); await shot("11-why");
  await clickText("show me the path"); await page.waitForSelector(".step", { timeout: 8000 }); await sleep(3500); // wait for live /api/plan
  await shot("12-plan", true);
  console.log("DONE");
} catch (e) { console.error("FAILED:", e.message); try { await page.screenshot({ path: `${OUT}/99-fail.png` }); } catch {} } finally { await browser.close(); }
