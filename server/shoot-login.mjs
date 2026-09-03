// Verifies the returning-user loop: register a fresh user, log out, then log back
// in with the same credentials and confirm we land in the app. Captures the new
// Login screen and Welcome's "Log in" entry point.
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
    if (ok) return; await sleep(200);
  }
  throw new Error("timeout clicking text: " + t);
}
async function hasText(t) { return page.evaluate((t) => document.body.innerText.replace(/\s+/g, " ").includes(t), t); }
async function shot(n) { await sleep(600); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); console.log("shot", n); }

const USER = "loopuser" + Date.now();
const PASS = "secret123";

try {
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE, { waitUntil: "networkidle2" });

  // 1. Register
  await clickText("Start");
  await clickText("My parent/guardian is here");
  const regInputs = await page.$$("input.ta");
  await regInputs[0].type(USER); await regInputs[1].type(PASS);
  await clickText("Create account"); await sleep(1100);
  await clickText("Continue"); await sleep(900);
  console.log("registered; on mode screen:", await hasText("goal in mind") || await hasText("not sure"));

  // 2. Log out -> back to Welcome (now shows Log in link)
  await clickText("Log out"); await sleep(700);
  await shot("14-welcome-with-login");
  console.log("welcome shows Log in link:", await hasText("Already have an account"));

  // 3. Go to Login
  await clickText("Already have an account"); await sleep(500);
  await shot("15-login");

  // 4. Log in with the SAME creds
  const logInputs = await page.$$("input.ta");
  await logInputs[0].type(USER); await logInputs[1].type(PASS);
  await clickText("Log in"); await sleep(1200);
  const backIn = (await hasText("goal in mind")) || (await hasText("not sure"));
  console.log("LOGIN ROUND-TRIP:", backIn ? "PASS — landed back in the app" : "FAIL — did not reach mode screen");

  // 5. Negative: wrong password
  await clickText("Log out"); await sleep(500);
  await clickText("Already have an account"); await sleep(400);
  const bad = await page.$$("input.ta");
  await bad[0].type(USER); await bad[1].type("wrongpass");
  await clickText("Log in"); await sleep(900);
  console.log("wrong-password rejected:", await hasText("Incorrect username or password"));

  console.log("DONE");
} catch (e) {
  console.error("FAILED:", e.message);
  try { await page.screenshot({ path: `${OUT}/99-login-fail.png` }); const txt = await page.evaluate(() => document.body.innerText.slice(0, 300)); console.log("STATE:", txt.replace(/\s+/g, " ")); } catch {}
} finally {
  await browser.close();
}
