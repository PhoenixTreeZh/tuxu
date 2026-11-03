import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TUXU_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const work=path.join(root,'_rea_temp/desktop-ui-preview');
const host=path.join(work,'android-style');
const baseline=process.argv.includes('--baseline');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{const r=await fetch('http://127.0.0.1:9337/json/version');if(r.ok)throw new Error('Another app owns test port 9337');}catch(e){if(!String(e).includes('fetch failed'))throw e;}
const child=spawn(path.join(host,'DrawingStudio.exe'),['--test'],{cwd:host,windowsHide:true,stdio:'ignore'});
let browser,page;const results={},errors=[];
async function ready(){await page.waitForFunction(()=>{const r=window.__reader,s=document.querySelector('.canvas-shell'),i=document.querySelector('.scene img');return r?.state.document&&!r.state.loading&&i?.complete&&i.naturalWidth>0&&s?.dataset.rendering==='false'&&s.dataset.frameId===s.dataset.displayedFrameId;},{},{timeout:20000});}
try{
  for(let i=0;i<100;i++){assert.equal(child.exitCode,null);try{if((await fetch('http://127.0.0.1:9337/json/version')).ok)break;}catch{}await delay(150);}
  browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
  for(let i=0;i<60;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('reader.invalid'));if(page)break;await delay(100);}
  assert(page);page.on('pageerror',e=>errors.push(String(e)));await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});await ready();
  if(!baseline){
    assert.equal(await page.evaluate(()=>window.__reader.state.question.id),'ch01/P1','A fresh process opens page one');
    for(let attempt=0;attempt<2;attempt++){
      await page.evaluate(()=>{localStorage.setItem('lastQuestion',JSON.stringify('ch06/P43-1'));localStorage.setItem('theme','light');});
      await page.reload();await ready();
      const start=await page.evaluate(()=>({id:window.__reader.state.question.id,first:window.__reader.state.catalog.questions[0].id,page:window.__reader.state.question.page,chapter:window.__reader.state.filters.chapter,step:window.__reader.state.view.step,matches:window.__reader.state.matches.length,total:window.__reader.state.catalog.questions.length}));
      assert.equal(start.id,start.first);assert.equal(start.page,1);assert.equal(start.chapter,'all');assert.equal(start.step,0);
      assert.equal(start.matches,start.total);assert.equal(await page.getByRole('combobox',{name:'章节',exact:true}).inputValue(),'all');
    }
    results.startupAlwaysFirstPage=true;
    results.startupAllChapters=true;
    await page.setViewportSize({width:1440,height:940});await ready();
    await page.screenshot({path:path.join(work,'screenshots/windows-startup-first-page.png')});
    await page.evaluate(()=>window.__reader.open('ch01/P4-1'));await ready();
    await page.getByRole('button',{name:'下一题',exact:true}).click();await ready();
    assert.equal(await page.evaluate(()=>window.__reader.state.question.id),'ch02/P5');
    assert.equal(await page.evaluate(()=>window.__reader.state.filters.chapter),'all');
    results.allChaptersCrossChapterNavigation=true;
  }
  const before=baseline?null:JSON.parse(fs.readFileSync(path.join(work,'reading-layout-before.json'),'utf8'));
  for(const size of [{width:1440,height:940},{width:900,height:640}]){
    await page.setViewportSize(size);await page.evaluate(()=>{window.__reader.filter({chapter:'ch01',page:null,query:'',bookmarks:false});return window.__reader.open('ch01/P2-1');});await ready();
    await page.evaluate(()=>{window.__reader.move(2);window.__reader.camera({zoom:null,x:0,y:0});});await ready();
    const geometry=await page.evaluate(()=>{
      const box=selector=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
      return{stage:box('.drawing-stage'),canvas:box('.canvas-shell'),appBar:box('.app-bar'),toolbar:box('.reader-toolbar'),canvasHeader:box('.canvas-header'),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    const key=size.width+'x'+size.height;results[key]=geometry;
    if(!baseline){
      const gain=geometry.stage.height-before[key].stage.height;
      assert(gain>=(size.width===1440?96:64),'More drawing height: '+gain);
      assert(geometry.appBar.height<=48&&geometry.toolbar.height<=48&&geometry.canvasHeader.height<=52);
      assert.equal(geometry.overflow,false);geometry.heightGained=gain;
      const bounds=await page.getByRole('button',{name:'下一步',exact:true}).boundingBox();assert(bounds.y+bounds.height<=size.height);
      await page.screenshot({path:path.join(work,'screenshots',size.width===1440?'windows-larger-canvas.png':'windows-larger-canvas-compact.png')});
    }
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(work,baseline?'reading-layout-before.json':'reading-layout-verification.json'),JSON.stringify({passed:true,...results,errors},null,2));
  console.log(JSON.stringify({baseline,...results},null,2));
}finally{
  if(page)await page.evaluate(()=>window.chrome?.webview?.postMessage({id:'layout-close',type:'window',action:'close'})).catch(()=>{});
  await delay(500);if(child.exitCode===null)child.kill();await browser?.close().catch(()=>{});
}
