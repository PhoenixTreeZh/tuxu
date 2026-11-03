// Smoke-test only the original sample, in a newly built dedicated output folder.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TUXU_PLAYWRIGHT_MODULE||'../studio/node_modules/playwright');
assert(process.env.STUDIO_OUTPUT,'Set STUDIO_OUTPUT to a dedicated original-demo build.');
const output=path.resolve(process.env.STUDIO_OUTPUT);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  if((await fetch('http://127.0.0.1:9337/json/version')).ok)throw new Error('Port 9337 is occupied; refusing to attach.');
} catch(error) {if(!String(error).includes('fetch failed'))throw error;}
const child=spawn(path.join(output,'DrawingStudio.exe'),['--test'],{cwd:output,windowsHide:true,stdio:'ignore'});
let browser;
try {
  let readyPort=false;
  for(let i=0;i<100;i++) {
    assert.equal(child.exitCode,null,'Owned demo process exited early.');
    try {if((await fetch('http://127.0.0.1:9337/json/version')).ok){readyPort=true;break;}}catch{}
    await delay(150);
  }
  assert(readyPort,'Owned demo did not start its test endpoint.');
  browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('reader.invalid'));
  assert(page,'Owned demo page missing.');
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setViewportSize({width:1440,height:940});
  const ready=()=>page.waitForFunction(()=>{
    const image=document.querySelector('.scene img'),shell=document.querySelector('.canvas-shell');
    return window.__reader?.state.document&&!window.__reader.state.loading&&image?.complete&&image.naturalWidth>0&&shell?.dataset.rendering==='false'&&shell.dataset.frameId===shell.dataset.displayedFrameId;
  });
  await ready();
  assert.equal(await page.evaluate(()=>window.__reader.state.catalog.questions.length),1);
  assert.equal(await page.evaluate(()=>window.__reader.frame().id),'demo-step-1');
  const images=[await page.locator('.scene img').getAttribute('src')];
  for(const fid of ['demo-step-2','demo-step-3']) {
    await page.getByRole('button',{name:'下一步',exact:true}).click();await ready();
    assert.equal(await page.evaluate(()=>window.__reader.frame().id),fid);
    images.push(await page.locator('.scene img').getAttribute('src'));
  }
  assert.equal(new Set(images).size,3,'Three steps must produce three distinct drawings.');
  const scene=await page.locator('.scene').boundingBox();assert(scene);
  await page.mouse.click(scene.x+scene.width/2,scene.y+scene.height/2);await ready();
  assert.equal(await page.evaluate(()=>window.__reader.frame().id),'demo-detail');
  await page.locator('.back-tool').click();await ready();
  assert.equal(await page.evaluate(()=>window.__reader.frame().id),'demo-step-3');
  const zoom=Number(await page.locator('.scene').getAttribute('data-zoom'));
  const stage=await page.locator('.canvas-shell').boundingBox();assert(stage);
  await page.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);
  await page.mouse.wheel(0,-200);await page.waitForTimeout(300);await ready();
  assert(Number(await page.locator('.scene').getAttribute('data-zoom'))>zoom,'Wheel must zoom the demo.');
  // Restore fitted view before the optional documentation screenshot.
  await page.getByRole('button',{name:'适应窗口',exact:true}).click();await ready();
  assert.deepEqual(errors,[]);
  if(process.env.TUXU_DEMO_SCREENSHOT)await page.screenshot({path:process.env.TUXU_DEMO_SCREENSHOT});
  console.log(JSON.stringify({passed:true,questions:1,distinctSteps:3,detailClick:true,detailReturn:true,wheelZoom:true}));
} finally {
  if(browser)await browser.close();
  if(child.exitCode===null){child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(2000)]);}
}
