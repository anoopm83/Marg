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
const ct = async (t, ms = 9000) => { const end = Date.now() + ms; while (Date.now() < end) { const ok = await page.evaluate((t) => { const e = [...document.querySelectorAll("button,a")].find(e => e.textContent && e.textContent.replace(/\s+/g, " ").includes(t)); if (e) { e.click(); return true; } return false; }, t); if (ok) return true; await sleep(200); } return false; };
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

  // Core option detail: Polytechnic (DTE link)
  await ct("Polytechnic Diploma"); await sleep(1600);
  console.log("core detail official portals:", await has("OFFICIAL PORTALS"));
  await page.screenshot({ path: `${OUT}/51-links-core.png`, fullPage: true });
  console.log("shot 51-links-core");

  // Back (topbar arrow is a .back button), open expansion, open Aviation
  await page.click(".back").catch(() => {}); await sleep(1000);
  await ct("PATHS YOU MIGHT NOT HAVE CONSIDERED") || await ct("more paths"); await sleep(1000);
  await ct("Aviation, Pilot"); await sleep(1400);
  console.log("specialized official portals:", await has("OFFICIAL PORTALS"), "| coast guard link:", await has("Coast Guard"));
  await page.screenshot({ path: `${OUT}/52-links-aviation.png`, fullPage: true });
  console.log("shot 52-links-aviation");
  console.log("DONE");
} catch (e) { console.error("FAILED:", e.message); try { await page.screenshot({ path: `${OUT}/99-links-fail.png` }); console.log("STATE:", (await page.evaluate(() => document.body.innerText.slice(0, 300))).replace(/\s+/g, " ")); } catch {} }
finally { await browser.close(); }
