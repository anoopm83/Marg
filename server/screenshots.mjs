// Drives the running Marg AI app through its screens and saves PNGs.
// Uses the Chrome already installed on the machine (puppeteer-core, no download).
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:5173/";
const OUT = path.join(process.cwd(), "..", "screenshots");
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2 });
// start clean each run
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

async function settle() {
  try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
  await new Promise((r) => setTimeout(r, 350));
}
async function click(sel) { await page.waitForSelector(sel, { visible: true, timeout: 8000 }); await page.click(sel); await settle(); }
async function shot(name) { await settle(); await page.screenshot({ path: path.join(OUT, name), fullPage: true }); console.log("captured", name); }

await page.goto(BASE, { waitUntil: "networkidle0" });
await page.waitForSelector('[data-go="consent"]', { timeout: 8000 });
await shot("01-welcome.png");

await click('[data-go="consent"]');                // -> consent (DPDP)
await shot("02-consent.png");

await click('[data-safety="1"]');                  // safety overlay
await shot("03-safety.png");
await click('[data-close-safety]');
await page.waitForSelector('#safety', { hidden: true, timeout: 5000 });

await click('[data-consent-path="self_serve"]');   // consent -> intake
await click('[data-val="Biology"]');
await click('[data-val="Making & art"]');
await click('[data-val="Doing work I love"]');
await shot("04-intake.png");

await click('[data-continue-intake="1"]');         // -> mode
await shot("05-mode.png");

await click('[data-go="explore"]');                // -> landscape
await shot("06-explore.png");

await click('[data-detail="pu_science"]');         // -> option detail
await shot("07-detail.png");

await click('[data-save="pu_science"]');
await click('[data-go="explore"]');
await click('[data-detail="pu_humanities"]');
await click('[data-save="pu_humanities"]');
await click('[data-go="explore"]');
await click('[data-go="shortlist"]');              // -> shortlist
await shot("08-shortlist.png");

await click('[data-go="explore"]');
await click('[data-go="mode"]');
await click('[data-go="aspire"]');
await click('[data-why="become_doctor"]');         // -> why-this-goal
await shot("09-why-goal.png");
await click('[data-plan="become_doctor"]');        // -> plan (with AI card)
await shot("10-aspire-plan.png");

await browser.close();
console.log("done ->", OUT);
