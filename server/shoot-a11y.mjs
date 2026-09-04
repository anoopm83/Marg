import puppeteer from "puppeteer-core";
const CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT="C:/Users/anoop/portfolio/MargAI/screenshots-app", BASE="http://localhost:5174";
const s=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:CHROME,headless:true,args:["--no-sandbox"]});
const p=await b.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.setViewport({width:460,height:1000,deviceScaleFactor:2});
async function clickTitle(t){await p.evaluate(t=>{const el=[...document.querySelectorAll("[title]")].find(e=>e.getAttribute("title")===t);if(el)el.click();},t);}
async function clickText(t,to=10000){const e=Date.now()+to;while(Date.now()<e){const ok=await p.evaluate(t=>{const el=[...document.querySelectorAll("button,a")].find(e=>e.textContent&&e.textContent.replace(/\s+/g," ").includes(t));if(el){el.click();return true;}return false;},t);if(ok)return;await s(200);}throw new Error("no "+t);}
async function shot(n){await s(500);await p.screenshot({path:`${OUT}/${n}.png`,fullPage:true});console.log("shot",n);}
try{
  await p.goto(BASE,{waitUntil:"networkidle2"}); await p.evaluate(()=>{try{localStorage.clear()}catch{}}); await p.goto(BASE,{waitUntil:"networkidle2"}); await s(1500);
  const theme=await p.evaluate(()=>document.documentElement.getAttribute("data-theme"));
  console.log("default theme:", theme, "| pageerrors:", errs.length?errs.join(" | "):"none");
  await shot("30-home-dark");
  await clickTitle("Light"); await s(500); await shot("31-home-light");
  await clickTitle("High contrast"); await s(500); await shot("32-home-contrast");
  await clickTitle("Dark"); await s(400);
  await clickText("A+"); await clickText("A+"); await s(400); await shot("33-home-bigtext");
  // a screen in dark to confirm theming propagates
  await clickText("A–"); await clickText("A–"); await s(300); // reset font
  await clickText("Explore your paths"); await s(600); await shot("34-personas-dark");
  console.log("DONE");
}catch(e){console.error("FAIL:",e.message);}finally{await b.close();}
