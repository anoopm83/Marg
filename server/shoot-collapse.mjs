import puppeteer from "puppeteer-core";
const CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT="C:/Users/anoop/portfolio/MargAI/screenshots-app", BASE="http://localhost:5174";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:CHROME,headless:true,args:["--no-sandbox"]});
const p=await b.newPage(); await p.setViewport({width:430,height:940,deviceScaleFactor:2});
async function click(t,to=12000){const e=Date.now()+to;while(Date.now()<e){const ok=await p.evaluate(t=>{const el=[...document.querySelectorAll("button,a")].find(e=>e.textContent&&e.textContent.replace(/\s+/g," ").includes(t));if(el){el.click();return true;}return false;},t);if(ok)return;await sleep(200);}throw new Error("no "+t);}
async function has(t){return p.evaluate(t=>document.body.innerText.replace(/\s+/g," ").includes(t),t);}
try{
  await p.goto(BASE,{waitUntil:"networkidle2"}); await p.evaluate(()=>{try{localStorage.clear()}catch{}}); await p.goto(BASE,{waitUntil:"networkidle2"}); await sleep(700);
  await click("Class 10 student"); await sleep(500);
  await click("Start"); await sleep(400);
  await click("My parent/guardian is here"); await sleep(500);
  const ins=await p.$$("input.ta"); await ins[0].type("cdemo"+Date.now()); await ins[1].type("secret123");
  await click("Create account"); await sleep(1100);
  await click("Continue"); await sleep(900);
  await click("I'm not sure yet"); await sleep(600);
  console.log("collapsed default (cards hidden):", !(await has("Polytechnic Diploma")) && await has("more paths"));
  await p.screenshot({path:`${OUT}/24-collapsed.png`,fullPage:true}); console.log("shot 24-collapsed");
  await click("PATHS YOU MIGHT NOT HAVE CONSIDERED"); await sleep(500);
  console.log("expanded (cards shown):", await has("Paramedical"));
  await p.screenshot({path:`${OUT}/25-expanded.png`,fullPage:true}); console.log("shot 25-expanded");
}catch(e){console.error("FAIL:",e.message);}finally{await b.close();}
