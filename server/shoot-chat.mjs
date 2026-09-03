// Captures the NEW conversational-chat surfaces (Mode A "ask about a stream" +
// Mode B free-text goal). These render without a live LLM call: Mode A shows the
// empty chat state, Mode B shows the goal box, GoalChat shows the seeded opener.
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
async function waitText(t, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const found = await page.evaluate((t) => [...document.querySelectorAll("*")].some((e) => e.childElementCount === 0 && e.textContent && e.textContent.replace(/\s+/g, " ").includes(t)), t);
    if (found) return; await sleep(200);
  }
  throw new Error("timeout waiting text: " + t);
}
async function shot(n, full = false) { await sleep(600); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full }); console.log("shot", n); }

try {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await clickText("Start");
  await clickText("My parent/guardian is here");
  const inputs = await page.$$("input.ta");
  await inputs[0].type("chatdemo" + Date.now());
  await inputs[1].type("secret123");
  await clickText("Create account"); await sleep(1100);
  await clickText("Biology"); await clickText("Making & art"); await clickText("Doing work I love"); await sleep(200);
  await clickText("Continue"); await sleep(900);

  // --- Mode A: detail -> open chat ---
  await clickText("I'm not sure yet"); await sleep(500);
  await clickText("PU — Science"); await sleep(1600);
  await clickText("Ask Marg"); await sleep(500);
  await page.screenshot({ path: `${OUT}/11-modeA-chat.png`, fullPage: true }); console.log("shot 11-modeA-chat (full)");

  // --- Mode B: free-text goal entry ---
  await page.goto(BASE, { waitUntil: "networkidle2" }); await sleep(600);
  await clickText("I have a goal in mind"); await sleep(500);
  await page.screenshot({ path: `${OUT}/12-modeB-goal.png`, fullPage: true }); console.log("shot 12-modeB-goal (full)");

  // type a goal with no exact pathway -> GoalChat seeded opener
  const ta = await page.$("textarea.ta");
  await ta.type("I want to design video games");
  await clickText("Talk it through with Marg"); await sleep(700);
  await page.screenshot({ path: `${OUT}/13-modeB-goalchat.png`, fullPage: true }); console.log("shot 13-modeB-goalchat (full)");

  console.log("DONE");
} catch (e) {
  console.error("FAILED:", e.message);
  try { await page.screenshot({ path: `${OUT}/99-chat-fail.png` }); const txt = await page.evaluate(() => document.body.innerText.slice(0, 300)); console.log("STATE:", txt.replace(/\s+/g, " ")); } catch {}
} finally {
  await browser.close();
}
