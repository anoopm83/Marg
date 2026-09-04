// Captures the multi-persona prototype: the persona picker, then the Mid-career
// (experimental) flow through intake/mode/explore, and confirms Class-10 is default.
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
  while (Date.now() < end) {
    const ok = await page.evaluate((t) => { const els = [...document.querySelectorAll("button,a")]; const el = els.find((e) => e.textContent && e.textContent.replace(/\s+/g, " ").includes(t)); if (el) { el.click(); return true; } return false; }, t);
    if (ok) return; await sleep(200);
  }
  throw new Error("timeout clicking text: " + t);
}
async function hasText(t) { return page.evaluate((t) => document.body.innerText.replace(/\s+/g, " ").includes(t), t); }
async function shot(n) { await sleep(650); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); console.log("shot", n); }

try {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await sleep(800);
  console.log("persona picker shows both:", await hasText("Class 10 student"), await hasText("Mid-career"));
  await shot("18-persona-pick");

  // Mid-career (experimental) flow
  await clickText("Mid-career"); await sleep(700);
  console.log("welcome ribbon/experimental persona set; adult welcome:", await hasText("Rethinking work"));
  await clickText("Start"); await sleep(600); // adult -> straight to register
  const ins = await page.$$("input.ta");
  await ins[0].type("mcdemo" + Date.now()); await ins[1].type("secret123");
  await clickText("Create account"); await sleep(1200);
  console.log("intake persona chips:", await hasText("What's pulling you right now"));
  await shot("19-midcareer-intake");
  await clickText("A change of field"); await clickText("Doing work I care about"); await sleep(200);
  await clickText("Continue"); await sleep(900);
  console.log("mode labels:", await hasText("I'm weighing my options"));
  await shot("20-midcareer-mode");
  await clickText("I'm weighing my options"); await sleep(700);
  console.log("explore midcareer + ribbon:", await hasText("Ways forward from where you are"), await hasText("Experimental persona"));
  await shot("21-midcareer-explore");

  // Confirm Class-10 remains the default/fallback
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" }); await sleep(700);
  await clickText("Class 10 student"); await sleep(700);
  console.log("class10 welcome intact:", await hasText("after Class 10"));

  console.log("DONE");
} catch (e) {
  console.error("FAILED:", e.message);
  try { await page.screenshot({ path: `${OUT}/99-persona-fail.png` }); console.log("STATE:", (await page.evaluate(() => document.body.innerText.slice(0, 400))).replace(/\s+/g, " ")); } catch {}
} finally { await browser.close(); }
