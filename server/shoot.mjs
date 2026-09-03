// Drives the real React app through the Explore slice and captures screenshots.
// Uses puppeteer-core + the installed Chrome (no chromium download).
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
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE.ERR:", m.text()); });
page.on("requestfailed", (r) => console.log("REQFAIL:", r.url(), r.failure()?.errorText));
await page.setViewport({ width: 430, height: 920, deviceScaleFactor: 2 });

async function findByText(t) {
  const h = await page.evaluateHandle((t) => {
    const els = [...document.querySelectorAll("button,a")];
    return els.find((e) => e.textContent && e.textContent.replace(/\s+/g, " ").includes(t));
  }, t);
  return h.asElement();
}
async function waitText(t, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const el = await findByText(t); if (el) return el; await sleep(200); }
  throw new Error("timeout waiting for text: " + t);
}
async function clickText(t, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const ok = await page.evaluate((t) => {
      const els = [...document.querySelectorAll("button,a")];
      const el = els.find((e) => e.textContent && e.textContent.replace(/\s+/g, " ").includes(t));
      if (el) { el.click(); return true; }
      return false;
    }, t);
    if (ok) return;
    await sleep(200);
  }
  throw new Error("timeout clicking text: " + t);
}
async function shot(n) { await sleep(550); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log("shot", n); }

try {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await waitText("Start");
  await shot("01-welcome");

  await clickText("Start"); await shot("02-consent");
  await clickText("Feeling low or unsafe"); await shot("03-safety"); await clickText("Close"); await sleep(250);

  await clickText("My parent/guardian is here"); await shot("04-register");
  const inputs = await page.$$("input.ta");
  await inputs[0].type("demo" + Date.now());
  await inputs[1].type("secret123");
  await clickText("Create account"); await sleep(1100); await shot("05-intake");

  await clickText("Biology"); await clickText("Making & art"); await clickText("Doing work I love"); await sleep(250);
  await clickText("Continue"); await sleep(1000); await shot("06-mode");

  await clickText("I'm not sure yet"); await sleep(500); await shot("07-explore");
  await clickText("PU — Science"); await waitText("Add to my shortlist"); await sleep(800);
  await page.screenshot({ path: `${OUT}/08-detail.png`, fullPage: true }); console.log("shot 08-detail (full)");
  await clickText("Add to my shortlist"); await sleep(500);
  await page.$$eval(".back", (els) => els[0] && els[0].click());
  await waitText("View my shortlist"); await clickText("View my shortlist");
  await waitText("Save & share"); await sleep(400); await shot("09-shortlist");

  console.log("DONE");
} catch (e) {
  console.error("FAILED:", e.message);
  try { await page.screenshot({ path: `${OUT}/99-fail.png` }); const txt = await page.evaluate(() => document.body.innerText.slice(0, 300)); console.log("STATE:", txt.replace(/\s+/g, " ")); } catch {}
} finally {
  await browser.close();
}
