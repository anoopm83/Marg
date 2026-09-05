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
const ct = async (t, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const ok = await page.evaluate((t) => { const e = [...document.querySelectorAll("button,a")].find(e => e.textContent && e.textContent.replace(/\s+/g, " ").includes(t)); if (e) { e.click(); return true; } return false; }, t); if (ok) return true; await sleep(200); }
  return false;
};
const has = (t) => page.evaluate((t) => document.body.innerText.replace(/\s+/g, " ").includes(t), t);
try {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" }); await sleep(500);
  await ct("Class 10"); await sleep(500);
  await ct("Start") || await ct("Get started"); await sleep(500);
  await ct("parent") || await ct("guardian") || await ct("Continue"); await sleep(700);
  await ct("Continue"); await sleep(700);
  await ct("not sure") || await ct("Explore"); await sleep(1200);
  // open the expansion tier
  await ct("PATHS YOU MIGHT NOT HAVE CONSIDERED") || await ct("more paths"); await sleep(900);
  console.log("expansion has civil services:", await has("Civil Services"));
  console.log("expansion has forestry:", await has("Forestry"));
  console.log("expansion has film:", await has("Film"));
  await page.screenshot({ path: `${OUT}/49-new-expansion.png`, fullPage: true });
  console.log("shot 49-new-expansion");
  // open the civil services detail
  await ct("Civil Services"); await sleep(1000);
  console.log("detail open (UPSC framing):", await has("any degree") || await has("ANY graduation") || await has("marathon"));
  await page.screenshot({ path: `${OUT}/50-civil-services.png`, fullPage: true });
  console.log("shot 50-civil-services");
  console.log("DONE");
} catch (e) { console.error("FAILED:", e.message); try { await page.screenshot({ path: `${OUT}/99-newopts-fail.png` }); console.log("STATE:", (await page.evaluate(() => document.body.innerText.slice(0, 300))).replace(/\s+/g, " ")); } catch {} }
finally { await browser.close(); }
