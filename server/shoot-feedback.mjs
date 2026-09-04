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
async function clickText(t, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const ok = await page.evaluate((t) => { const els = [...document.querySelectorAll("button,a")]; const el = els.find((e) => e.textContent && e.textContent.replace(/\s+/g, " ").includes(t)); if (el) { el.click(); return true; } return false; }, t); if (ok) return; await sleep(200); }
  throw new Error("timeout clicking: " + t);
}
async function hasText(t){ return page.evaluate((t)=>document.body.innerText.replace(/\s+/g," ").includes(t), t); }
try {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" }); await sleep(700);
  await clickText("Class 10 student"); await sleep(600);
  await clickText("Start"); await sleep(400);
  await clickText("My parent/guardian is here"); await sleep(500);
  const ins = await page.$$("input.ta");
  await ins[0].type("fbdemo" + Date.now()); await ins[1].type("secret123");
  await clickText("Create account"); await sleep(1100);
  await clickText("Continue"); await sleep(900);
  await clickText("I'm not sure yet"); await sleep(500);
  await clickText("PU — Science"); await sleep(1800);
  console.log("feedback widget present:", await hasText("Was this helpful"));
  await page.screenshot({ path: `${OUT}/22-feedback.png`, fullPage: true }); console.log("shot 22-feedback");
  // click thumbs-up to confirm interaction + note field
  await clickText("👍"); await sleep(400);
  console.log("note field appears:", await hasText("Anything you'd add"));
  console.log("DONE");
} catch (e) { console.error("FAILED:", e.message); try { await page.screenshot({ path: `${OUT}/99-fb-fail.png` }); console.log("STATE:", (await page.evaluate(()=>document.body.innerText.slice(0,300))).replace(/\s+/g," ")); } catch {} }
finally { await browser.close(); }
