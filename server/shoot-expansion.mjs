// Captures Explore with the new "Paths you might not have considered" tier, and a
// specialized-pathway detail (Paramedical & Allied Health).
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
  throw new Error("timeout clicking text: " + t);
}
async function hasText(t) { return page.evaluate((t) => document.body.innerText.replace(/\s+/g, " ").includes(t), t); }
async function shot(n) { await sleep(600); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); console.log("shot", n); }
try {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await clickText("Start");
  await clickText("My parent/guardian is here");
  const ins = await page.$$("input.ta");
  await ins[0].type("expdemo" + Date.now()); await ins[1].type("secret123");
  await clickText("Create account"); await sleep(1100);
  await clickText("Continue"); await sleep(900);
  await clickText("I'm not sure yet"); await sleep(600);
  console.log("expansion section present:", await hasText("PATHS YOU MIGHT NOT HAVE CONSIDERED"));
  await shot("16-explore-expansion");
  await clickText("Paramedical"); await sleep(700);
  console.log("frame present:", await hasText("HOW TO READ THIS PATH"));
  await shot("17-specialized-detail");
  console.log("DONE");
} catch (e) {
  console.error("FAILED:", e.message);
  try { await page.screenshot({ path: `${OUT}/99-exp-fail.png` }); console.log("STATE:", (await page.evaluate(() => document.body.innerText.slice(0, 300))).replace(/\s+/g, " ")); } catch {}
} finally { await browser.close(); }
