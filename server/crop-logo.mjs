import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe";
const SRC="C:/Users/anoop/AppData/Local/Temp/claude/c--Users-anoop-portfolio-MargAI/484d8169-4c9b-4628-b4c9-4142cc0318d8/scratchpad/proposal/word/media/image1.png";
const OUTDIR="C:/Users/anoop/portfolio/MargAI/web/public";
mkdirSync(OUTDIR,{recursive:true});
const b64=readFileSync(SRC).toString("base64");
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:["--no-sandbox"]});
const page=await browser.newPage();
const dataUrl=await page.evaluate(async (src)=>{
  const img=new Image(); img.src=src; await img.decode();
  const sy=58, sh=img.naturalHeight-sy;                 // drop top strip (the "Made with AI" badge)
  const c=document.createElement("canvas"); c.width=img.naturalWidth; c.height=sh;
  const ctx=c.getContext("2d");
  ctx.drawImage(img,0,sy,img.naturalWidth,sh,0,0,img.naturalWidth,sh);
  const d=ctx.getImageData(0,0,c.width,c.height); const p=d.data;
  for(let i=0;i<p.length;i+=4){ if(p[i]>246&&p[i+1]>246&&p[i+2]>246) p[i+3]=0; } // white -> transparent
  ctx.putImageData(d,0,0);
  return c.toDataURL("image/png");
}, "data:image/png;base64,"+b64);
writeFileSync(OUTDIR+"/marg-logo.png", Buffer.from(dataUrl.split(",")[1],"base64"));
console.log("saved web/public/marg-logo.png");
await browser.close();
