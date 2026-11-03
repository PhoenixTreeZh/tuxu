import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TUXU_PLAYWRIGHT_MODULE||'../studio/node_modules/playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const work=path.join(root,'_rea_temp/release-android');
const output=path.join(work,'svg-renders');fs.mkdirSync(output,{recursive:true});
const lib=JSON.parse(fs.readFileSync(path.join(root,'_rea_temp/reader/content/library.json'),'utf8'));
const map=JSON.parse(fs.readFileSync(path.join(work,'scene-map.json'),'utf8'));
const executable=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const context=await chromium.launchPersistentContext(path.join(work,'svg-browser-profile'),{executablePath:executable,headless:true,viewport:{width:1100,height:900},deviceScaleFactor:1,env:{...process.env,TEMP:work,TMP:work}});
await context.route('**/*',route=>route.request().url().startsWith('data:')?route.continue():route.abort());
const pages=await Promise.all(Array.from({length:4},()=>context.newPage()));
const results=[];
try {
  await Promise.all(pages.map(async(page,partition)=>{
  for(const [itemIndex,[id,relative]] of Object.entries(map).entries()) {
    if(itemIndex%pages.length!==partition)continue;
    if(process.env.SVG_ONLY&&process.env.SVG_ONLY!==id)continue;
    const filename=id.replaceAll('/','_')+'.png';
    const svg=fs.readFileSync(path.join(root,'apps/android/app/src/main/assets/content',relative),'utf8');
    const frame=lib.frames[id];
    await page.setContent('<style>html,body{margin:0;background:black}svg{display:block}</style>'+svg,{waitUntil:'load'});
    await page.evaluate(async()=>{
      await Promise.all([...document.querySelectorAll('image')].map(async element=>{
        const href=element.getAttributeNS('http://www.w3.org/1999/xlink','href');
        if(href){const image=new Image();image.src=href;await image.decode();}
      }));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    await page.screenshot({path:path.join(output,filename),clip:{x:0,y:0,width:frame.width,height:frame.height},animations:'disabled'});
    results.push({id,render:filename,reference:frame.image,hasWmf:frame.scene.operations.some(o=>o.kind==='metafile'),hasText:frame.scene.operations.some(o=>o.kind==='text')});
    if(results.length%200===0)console.log(`Rendered ${results.length} SVG scenes`);
  }
  }));
}finally {await context.close();}
fs.writeFileSync(path.join(work,process.env.SVG_ONLY?'svg-sample-manifest.json':'svg-render-manifest.json'),JSON.stringify(results));
console.log(JSON.stringify({rendered:results.length}));
