// Runs only an isolated preview host. Does not build or replace release packages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TUXU_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const work=path.join(root,'_rea_temp/desktop-ui-preview');
const host=path.join(work,'android-style');
const previews=path.join(work,'screenshots');fs.mkdirSync(previews,{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{const response=await fetch('http://127.0.0.1:9337/json/version');if(response.ok)throw new Error('Port 9337 is occupied; refusing another app.');}catch(error){if(!String(error).includes('fetch failed'))throw error;}
const log=fs.openSync(path.join(work,'ui-preview.log'),'w');
const child=spawn(path.join(host,'DrawingStudio.exe'),['--test'],{cwd:host,windowsHide:true,stdio:['ignore',log,log]});
let browser,page;const errors=[],checks={};
async function ready(){await page.waitForFunction(()=>{
  const r=window.__reader,s=document.querySelector('.canvas-shell'),i=document.querySelector('.scene img');
  return !r?.state.loading&&r?.state.document&&(r.state.document.videoPath||i?.complete&&i.naturalWidth>0&&s?.dataset.rendering==='false'&&s.dataset.frameId===s.dataset.displayedFrameId);
},{},{timeout:20000});}
async function open(id){await page.evaluate(id=>window.__reader.open(id),id);await ready();}
async function shot(name){await page.screenshot({path:path.join(previews,name+'.png')});}
async function settings(){await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('.settings-dialog').waitFor({state:'visible'});const box=await page.locator('.settings-dialog').boundingBox(),size=page.viewportSize();assert(Math.abs(box.x+box.width/2-size.width/2)<2&&Math.abs(box.y+box.height/2-size.height/2)<2,'Dialog is centered');}
async function appearance(){await settings();await page.getByRole('button',{name:/^外观/}).click();}
async function choose(name){await page.getByRole('radio',{name:new RegExp('^'+name)}).click();}
async function closed(){await page.getByRole('button',{name:'关闭设置',exact:true}).click();await page.locator('.settings-dialog').waitFor({state:'hidden'});}
async function snapshot(){return page.evaluate(()=>({id:window.__reader.state.question.id,view:JSON.stringify(window.__reader.state.view)}));}
try{
  for(let i=0;i<100;i++){assert.equal(child.exitCode,null,'Preview exited');try{const response=await fetch('http://127.0.0.1:9337/json/version');if(response.ok)break;}catch{}await delay(150);}
  browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
  for(let i=0;i<60;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('reader.invalid'));if(page)break;await delay(100);}
  assert(page,'Owned preview page');page.on('pageerror',e=>errors.push(String(e)));
  await page.setViewportSize({width:1440,height:940});await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});await ready();
  await page.evaluate(()=>window.__reader.filter({chapter:'ch01',page:null,query:'',bookmarks:false}));await open('ch01/P2-1');
  await page.evaluate(()=>window.__reader.move(2));await ready();
  const four=await page.locator('.navigation-buttons>button').allTextContents();
  assert.deepEqual(four,['上一题','上一步','下一步','下一题']);
  const nextStep=await page.getByRole('button',{name:'下一步',exact:true}).boundingBox();
  const fullTransport=await page.locator('.reading-transport').boundingBox();
  await page.evaluate(()=>window.__reader.move(0));await ready();
  assert.equal(await page.locator('.navigation-buttons>button').count(),3);
  const previous=await page.getByRole('button',{name:'上一题',exact:true}).boundingBox();assert(previous.width>nextStep.width*1.9);
  await page.evaluate(()=>window.__reader.move(window.__reader.sequence().length-1));await ready();
  const nextQuestion=await page.getByRole('button',{name:'下一题',exact:true}).boundingBox();
  assert(Math.abs(nextQuestion.x-nextStep.x)<1&&nextQuestion.width>nextStep.width*1.9);
  const endTransport=await page.locator('.reading-transport').boundingBox();assert(Math.abs(fullTransport.y-endTransport.y)<1);
  await page.mouse.click(nextStep.x+nextStep.width/2,nextStep.y+nextStep.height/2);await ready();
  assert.equal(await page.evaluate(()=>window.__reader.state.question.id),'ch01/P2-2');checks.fixedFourButtonsAndMergedEnd=true;

  await open('ch01/P2-1');await page.evaluate(()=>{window.__reader.filter({query:'P2-1'});window.__reader.move(window.__reader.sequence().length-1);});await ready();
  const beforeNotice=await page.locator('.navigation-buttons').boundingBox();
  await page.getByRole('button',{name:'下一题',exact:true}).click();
  assert.match(await page.getByRole('status').innerText(),/当前筛选的最后一题/);
  const afterNotice=await page.locator('.navigation-buttons').boundingBox();assert.deepEqual(afterNotice,beforeNotice);
  await page.getByRole('button',{name:'上一题',exact:true}).click();assert.match(await page.getByRole('status').innerText(),/当前筛选的第一题/);
  assert.equal(await page.evaluate(()=>window.__reader.state.question.id),'ch01/P2-1');checks.nonBlockingBoundaryNotice=true;

  await page.evaluate(()=>window.__reader.filter({chapter:'ch06',page:null,query:'',bookmarks:false}));await open('ch06/P43-1');
  const original=await snapshot();
  await appearance();await choose('浅色');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await closed();assert.deepEqual(await snapshot(),original);await shot('windows-light');
  await settings();await shot('windows-settings-light');
  await page.getByRole('button',{name:/^外观/}).click();await choose('深色');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await shot('windows-appearance-dark');
  await closed();assert.deepEqual(await snapshot(),original);await shot('windows-dark');
  await page.evaluate(()=>window.__reader.filter({chapter:'ch01',page:null,query:'',bookmarks:false}));await open('ch01/P2-1');await page.evaluate(()=>window.__reader.move(2));await ready();await shot('windows-steps-dark');
  await page.evaluate(()=>window.__reader.filter({chapter:'ch06',page:null,query:'',bookmarks:false}));await open('ch06/P43-1');
  await appearance();await choose('跟随系统');
  await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  assert.equal(await page.evaluate(()=>localStorage.getItem('theme')),'system');
  await page.getByRole('radio',{name:/^跟随系统/}).focus();await page.keyboard.press('ArrowUp');
  assert.equal(await page.getByRole('radio',{name:/^浅色/}).getAttribute('aria-checked'),'true');
  assert.deepEqual(await snapshot(),original);await closed();checks.appearanceModesAndKeyboard=true;

  await settings();await page.getByRole('button',{name:/^支持我/}).click();
  await page.locator('.support-payment').evaluate(image=>image.decode());
  const digest=await page.locator('.support-payment').evaluate(async image=>{
    const bytes=await(await fetch(image.currentSrc)).arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  });
  assert.equal(digest,createHash('sha256').update(fs.readFileSync(path.join(root,'apps/android/app/src/main/res/drawable-nodpi/support_payment.jpg'))).digest('hex'));
  await shot('windows-support');
  await page.keyboard.press('Control+k');assert.equal(await page.locator('[cmdk-dialog]').count(),0);
  await page.keyboard.press('ArrowRight');assert.deepEqual(await snapshot(),original);
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:/^关于图序/}).count(),1);
  await shot('windows-settings');await page.getByRole('button',{name:/^关于图序/}).click();
  assert.match(await page.locator('.about-information').innerText(),/PhoenixTree/);assert.match(await page.locator('.about-feedback').innerText(),/phoenixtree_zh@163.com/);await shot('windows-about');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('.settings-dialog').waitFor({state:'hidden'});
  assert.equal(await page.getByRole('button',{name:'设置',exact:true}).evaluate(e=>document.activeElement===e),true);checks.originalPaymentCodeAndCredits=true;checks.modalFocusAndReaderIsolation=true;

  await page.evaluate(()=>window.__reader.filter({chapter:'ch01',page:null,query:'',bookmarks:false}));await open('ch01/P2-1');await page.evaluate(()=>window.__reader.move(2));await ready();await shot('windows-steps-light');
  await page.evaluate(()=>window.__reader.filter({chapter:'ch06',page:null,query:'',bookmarks:false}));await open('ch06/P43-1');

  await page.setViewportSize({width:900,height:640});await ready();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  for(const button of await page.locator('.navigation-buttons>button').all()){
    const visible=await button.evaluate(e=>{const s=e.querySelector('span'),r=s.getBoundingClientRect(),b=e.getBoundingClientRect();return r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom;});assert(visible,'Navigation text fits');
  }
  await shot('windows-compact');await appearance();await choose('深色');await shot('windows-compact-settings');await closed();
  await page.reload();await ready();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');checks.compactAndAppearancePersistence=true;
  assert.deepEqual(errors,[]);
  const releases=JSON.parse(fs.readFileSync(path.join(work,'unchanged-releases.json'),'utf8'));
  for(const [file,sha] of Object.entries(releases))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),sha);
  checks.releasePackagesUnchanged=true;
  fs.writeFileSync(path.join(work,'ui-verification.json'),JSON.stringify({passed:true,checks,paymentSha256:digest,errors,scope:'Isolated real WebView2 + native drawing engine preview. No installation/EXE/APK packaging or release replacement.'},null,2));
  console.log(JSON.stringify({passed:true,checks,previews},null,2));
}finally{
  if(page)await page.evaluate(()=>window.chrome?.webview?.postMessage({id:'preview-close',type:'window',action:'close'})).catch(()=>{});
  await delay(400);if(child.exitCode===null)child.kill();await browser?.close().catch(()=>{});fs.closeSync(log);
}
