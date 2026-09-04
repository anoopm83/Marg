import puppeteer from "puppeteer-core";
const CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT="C:/Users/anoop/portfolio/MargAI/screenshots-app", BASE="http://localhost:5174";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:CHROME,headless:true,args:["--no-sandbox"]});
const p=await b.newPage(); await p.setViewport({width:430,height:1000,deviceScaleFactor:2});
async function click(t,to=12000){const e=Date.now()+to;while(Date.now()<e){const ok=await p.evaluate(t=>{const el=[...document.querySelectorAll("button,a")].find(e=>e.textContent&&e.textContent.replace(/\s+/g," ").includes(t));if(el){el.click();return true;}return false;},t);if(ok)return;await sleep(200);}throw new Error("no "+t);}
async function has(t){return p.evaluate(t=>document.body.innerText.replace(/\s+/g," ").includes(t),t);}
try{
  await p.goto(BASE,{waitUntil:"networkidle2"}); await p.evaluate(()=>{try{localStorage.clear()}catch{}}); await p.goto(BASE,{waitUntil:"networkidle2"}); await sleep(800);
  console.log("three personas:", await has("Class 10 student"), await has("Mid-career"), await has("Retiree"));
  await p.screenshot({path:`${OUT}/26-persona-pick-3.png`,fullPage:true}); console.log("shot 26");
  await click("Retiree"); await sleep(600);
  await click("Start"); await sleep(500); // adult -> register
  const ins=await p.$$("input.ta"); await ins[0].type("rdemo"+Date.now()); await ins[1].type("secret123");
  await click("Create account"); await sleep(1200);
  console.log("retiree intake:", await has("What draws you now"));
  await click("Faith & reflection"); await click("Peace and calm"); await sleep(200);
  await click("Continue"); await sleep(900);
  await click("I'm exploring what's next"); await sleep(700);
  console.log("retiree explore + ribbon:", await has("Ways to shape this chapter"), await has("Experimental persona"));
  await p.screenshot({path:`${OUT}/27-retiree-explore.png`,fullPage:true}); console.log("shot 27");
}catch(e){console.error("FAIL:",e.message); try{await p.screenshot({path:`${OUT}/99-ret-fail.png`});console.log("STATE:",(await p.evaluate(()=>document.body.innerText.slice(0,300))).replace(/\s+/g," "));}catch{}}finally{await b.close();}
