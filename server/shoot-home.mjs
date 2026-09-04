import puppeteer from "puppeteer-core";
const CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT="C:/Users/anoop/portfolio/MargAI/screenshots-app", BASE="http://localhost:5174";
const b=await puppeteer.launch({executablePath:CHROME,headless:true,args:["--no-sandbox"]});
const p=await b.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.setViewport({width:460,height:1000,deviceScaleFactor:2});
await p.goto(BASE,{waitUntil:"networkidle2"}); await new Promise(r=>setTimeout(r,1600));
await p.screenshot({path:`${OUT}/28-home-full.png`,fullPage:true});
// also just the first viewport (what a link-opener sees at rest)
await p.screenshot({path:`${OUT}/28-home-top.png`});
console.log("pageerrors:", errs.length?errs.join(" | "):"none");
await b.close();
