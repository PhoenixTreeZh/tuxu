import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TUXU_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.env.STUDIO_OUTPUT||path.join(root,'apps/desktop/bin/Release/net10.0-windows/win-x64');
const work=process.env.STUDIO_VERIFY_WORK||path.join(root,'_rea_temp/frontend-rewrite');fs.mkdirSync(work,{recursive:true});
const exe=path.join(output,'DrawingStudio.exe');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{const active=await fetch('http://127.0.0.1:9337/json/version');if(active.ok)throw new Error('Test port 9337 is already occupied; refusing to attach to another app.');}catch(error){if(!String(error).includes('fetch failed'))throw error;}
const log=fs.openSync(path.join(work,'desktop-test.log'),'w');
const processHandle=spawn(exe,['--test'],{cwd:output,windowsHide:true,stdio:['ignore',log,log]});
let browser,page;
const errors=[],checks={};
async function ready(){await page.waitForFunction(()=>{
  const store=window.__reader;if(!store?.state.document||store.state.loading)return false;
  if(store.state.document.videoPath)return Boolean(document.querySelector('video'));
  const image=document.querySelector('.scene img'),shell=document.querySelector('.canvas-shell');return image?.complete&&image.naturalWidth>0&&shell?.dataset.rendering==='false'&&shell.dataset.displayedFrameId===shell.dataset.frameId;
},{},{timeout:15000});}
async function open(id){await page.evaluate(id=>window.__reader.open(id),id);await ready();}
async function setTheme(name){
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('button',{name:/^外观/}).click();
  await page.getByRole('radio',{name:new RegExp('^'+name)}).click();
  await page.getByRole('button',{name:'关闭设置',exact:true}).click();
}
async function rootFrame(id){await page.evaluate(id=>{
  const reader=window.__reader,d=reader.state.document;
  if(d.questionFrames.includes(id))reader.mode('question');
  else if(d.supplementFrames.includes(id))reader.mode('supplement');
  else{reader.mode('answer');reader.branch(d.branches.find(b=>b.frames.includes(id)).id);}
  while(reader.state.view.history.length)reader.back();reader.move(reader.sequence().indexOf(id));
},id);await ready();}
async function clickHotspot(h){
  const frame=await page.evaluate(()=>window.__reader.frame());
  const rect=h.rect;let point;
  for(const fy of [.5,.25,.75,.1,.9])for(const fx of [.5,.25,.75,.1,.9]){
    if(point)continue;
    const x=Math.floor(rect[0]+(rect[2]-rect[0])*fx),y=Math.floor(rect[1]+(rect[3]-rect[1])*fy);
    const first=frame.hotspots.find(p=>x>=p.rect[0]&&x<p.rect[2]&&y>=p.rect[1]&&y<p.rect[3]);if(first?.id===h.id)point={x,y};
  }
  for(let y=rect[1]+2;y<rect[3]-1&&!point;y+=Math.max(1,Math.floor((rect[3]-rect[1])/12)))for(let x=rect[0]+2;x<rect[2]-1;x+=Math.max(1,Math.floor((rect[2]-rect[0])/12))){
    const first=frame.hotspots.find(p=>x>=p.rect[0]&&x<p.rect[2]&&y>=p.rect[1]&&y<p.rect[3]);if(first?.id===h.id){point={x,y};break;}}
  assert(point,'Clickable region has an unoccluded point: '+h.id);
  const bounds=await page.locator('.scene').boundingBox();
  await page.mouse.click(bounds.x+(point.x-frame.viewport[0])*bounds.width/frame.width,bounds.y+(point.y-frame.viewport[1])*bounds.height/frame.height);
  await ready();
  const actual=await page.evaluate(()=>window.__reader.state.view.detail?.id);
  assert.equal(actual,h.target_frame_id??h.target_animation_id,h.id);
}
try{
  for(let i=0;i<100;i++){if(processHandle.exitCode!==null)throw new Error('Desktop exited: '+processHandle.exitCode);try{const version=await fetch('http://127.0.0.1:9337/json/version');if(version.ok)break;}catch{}await delay(200);}
  browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
  for(let i=0;i<50;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('reader.invalid'));if(page)break;await delay(100);}
  assert(page,'Owned WebView page is available');page.on('pageerror',error=>errors.push(String(error)));
  await page.setViewportSize({width:1440,height:940});await ready();
  assert.equal(await page.title(),'图序 · 工程图学');
  await page.screenshot({path:path.join(work,'studio-main.png')});
  console.log('Native React interface loaded and rendered.');
  if(!process.argv.includes('--smoke')){
    await page.getByLabel('章节',{exact:true}).selectOption('ch01');
    await open('ch01/P2-1');await page.getByRole('tab',{name:'答案',exact:true}).click();await ready();
    await page.getByRole('button',{name:'下一步',exact:true}).click();await ready();
    assert.equal(await page.evaluate(()=>window.__reader.state.view.step),1);
    await page.getByRole('button',{name:'最终答案',exact:true}).click();await ready();
    assert.equal(await page.evaluate(()=>window.__reader.state.view.step),10);
    await page.getByRole('button',{name:'下一题',exact:true}).click();await ready();
    assert.equal(await page.evaluate(()=>window.__reader.state.question.id),'ch01/P2-2');checks.stepToNextQuestion=true;
    await open('ch01/P2-1');assert.equal(await page.evaluate(()=>window.__reader.state.view.step),10);
    await page.getByRole('tab',{name:'题图',exact:true}).click();await ready();await page.getByRole('tab',{name:'答案',exact:true}).click();await ready();
    assert.equal(await page.evaluate(()=>window.__reader.state.view.step),10);checks.readingMemory=true;
    await open('exercises/P50-9');
    const branches=await page.evaluate(()=>window.__reader.state.document.branches);
    const steps=branches.find(b=>b.kind==='steps'),figure=branches.find(b=>b.kind==='answer_figure');
    await page.getByRole('combobox',{name:'答案内容',exact:true}).selectOption(steps.id);
    await page.evaluate(()=>window.__reader.move(4));await ready();
    await page.getByRole('tab',{name:'题图',exact:true}).click();await ready();await page.getByRole('tab',{name:'答案',exact:true}).click();await ready();
    await page.getByRole('combobox',{name:'答案内容',exact:true}).selectOption(figure.id);await ready();
    await page.getByRole('tab',{name:'题图',exact:true}).click();await ready();await page.getByRole('tab',{name:'答案',exact:true}).click();await ready();
    assert.equal(await page.evaluate(()=>window.__reader.state.view.branch),figure.id,'Question figure does not resurrect an older answer branch');
    await page.getByRole('combobox',{name:'答案内容',exact:true}).selectOption(steps.id);await ready();
    assert.equal(await page.evaluate(()=>window.__reader.state.view.step),4);checks.answerBranchMemory=true;
    await page.keyboard.press('Control+k');await page.getByPlaceholder('输入 P43-1、43页，或第6章…').fill('第六章 第43页 第1题');
    await page.locator('[cmdk-item]').first().click();await ready();
    assert.equal(await page.evaluate(()=>window.__reader.state.question.id),'ch06/P43-1');checks.commandSearch=true;
    await page.evaluate(()=>window.__reader.filter({query:'',chapter:'ch06',page:null}));
    await page.getByRole('button',{name:'放大',exact:true}).click();await ready();
    const stage=await page.locator('.drawing-stage').boundingBox();
    const before=await page.evaluate(()=>window.__reader.state.view.camera);
    await page.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);await page.mouse.down();await page.mouse.move(stage.x+stage.width/2+50,stage.y+stage.height/2+35,{steps:5});await page.mouse.up();
    const after=await page.evaluate(()=>window.__reader.state.view.camera);assert(Math.abs(after.x-before.x-50)<2);assert(Math.abs(after.y-before.y-35)<2);checks.dragPan=true;
    const oldZoom=after.zoom;await page.mouse.wheel(0,-120);await page.waitForTimeout(120);await ready();assert((await page.evaluate(()=>window.__reader.state.view.camera.zoom))>oldZoom);checks.wheelZoom=true;
    await page.getByRole('button',{name:'适应窗口',exact:true}).click();await ready();
    const documents=JSON.parse(fs.readFileSync(path.join(output,'content/index/catalog.json'),'utf8')).questions;
    const visited=new Set(),animations=new Set();let returnRegions=0;
    for(const meta of documents){
      const doc=JSON.parse(fs.readFileSync(path.join(output,'content',meta.dataPath),'utf8'));
      if(!Object.values(doc.frames).some(f=>f.hotspots.length))continue;
      await open(meta.id);
      const roots=[...doc.questionFrames,...doc.supplementFrames,...doc.branches.flatMap(b=>b.frames)];
      const routes=new Map(roots.map(fid=>[fid,{root:fid,path:[]} ]));const todo=[...roots];
      while(todo.length){const fid=todo.shift();for(const h of doc.frames[fid].hotspots){if(h.kind==='detail'&&!routes.has(h.target_frame_id)){const route=routes.get(fid);routes.set(h.target_frame_id,{root:route.root,path:[...route.path,h]});todo.push(h.target_frame_id);}}}
      for(const [fid,frame] of Object.entries(doc.frames))for(const hotspot of frame.hotspots){
        if(hotspot.kind==='back'){returnRegions++;continue;}
        const set=hotspot.kind==='animation'?animations:visited;const target=hotspot.target_frame_id??hotspot.target_animation_id;if(set.has(target))continue;
        const route=routes.get(fid);assert(route,'Source-backed root route for '+fid);await rootFrame(route.root);
        for(const ancestor of route.path)await clickHotspot(ancestor);
        await clickHotspot(hotspot);set.add(target);
        await page.getByRole('button',{name:'返回上一图',exact:true}).first().click();await ready();
        assert.equal(await page.evaluate(()=>window.__reader.frame()?.id),fid,'Detail returns to its actual parent');
      }
    }
    assert.equal(visited.size,101);assert.equal(animations.size,14);assert(returnRegions>0);checks.clickableDetails=visited.size;checks.animations=animations.size;checks.returnRegions=returnRegions;
    console.log('All 101 details and 14 model animations opened through actual picture regions.');
    for(const id of ['ch01/P3-1','ch01/P3-2']){
      await open(id);await page.getByRole('tab',{name:'题图',exact:true}).click();await ready();
      const f=await page.evaluate(()=>window.__reader.frame().id);assert.equal(f,id.endsWith('-1')?'ch01/node-139':'ch01/node-174');
    }checks.clearFramesRemoved=true;
    const videos=[];
    for(const q of documents.filter(q=>q.video)){
      await open(q.id);await page.waitForFunction(()=>{const video=document.querySelector('video');return video?.readyState>=1||video?.error;});
      const info=await page.locator('video').evaluate(v=>({duration:v.duration,error:v.error?.message,source:v.currentSrc}));
      assert(!info.error,q.id+': '+info.error);assert(info.duration>0,q.id+': positive duration');videos.push({id:q.id,duration:info.duration});
    }checks.videos=videos;
    // Add real bridge latency, then operate the actual range input. The old
    // frame must remain visible and obsolete queued renders must be skipped.
    await open('ch01/P2-2');await page.getByRole('tab',{name:'答案',exact:true}).click();
    await page.evaluate(()=>window.__reader.move(0));await ready();
    await page.evaluate(()=>{
      const bridge=window.chrome.webview,send=bridge.postMessage.bind(bridge);
      window.__scrubProbe={delay:180,calls:[],blank:0,overlays:0,send};
      bridge.postMessage=message=>{if(message.type==='render'){window.__scrubProbe.calls.push(message.frame);setTimeout(()=>send(message),window.__scrubProbe.delay);}else send(message);};
      window.__scrubProbe.observer=new MutationObserver(()=>{const shell=document.querySelector('.canvas-shell');if(!shell)return;if(shell.querySelector('.canvas-loading'))window.__scrubProbe.overlays++;if(!shell.querySelector('.scene img')?.naturalWidth)window.__scrubProbe.blank++;});
      window.__scrubProbe.observer.observe(document.querySelector('.canvas-shell'),{subtree:true,attributes:true,childList:true});
      window.__scrubProbe.oldSource=document.querySelector('.scene img').src;
      window.__reader.move(14);
    });
    await delay(30);
    assert(await page.evaluate(()=>document.querySelector('.scene img').src===window.__scrubProbe.oldSource),'Previous image remains visible until the next image is decoded');
    const slider=await page.getByRole('slider',{name:'绘制步骤',exact:true}).boundingBox();
    await page.mouse.move(slider.x+4,slider.y+slider.height/2);await page.mouse.down();await page.mouse.move(slider.x+slider.width-4,slider.y+slider.height/2,{steps:18});await page.mouse.up();await ready();
    const scrub=await page.evaluate(()=>({blank:window.__scrubProbe.blank,overlays:window.__scrubProbe.overlays,calls:window.__scrubProbe.calls.length,step:window.__reader.state.view.step,final:window.__reader.sequence().length-1,displayed:document.querySelector('.scene img').dataset.frameId,expected:window.__reader.frame().id}));
    assert.equal(scrub.blank,0);assert.equal(scrub.overlays,0);assert.equal(scrub.step,scrub.final);assert.equal(scrub.displayed,scrub.expected);assert(scrub.calls<10,'Rapid drag coalesces native drawing requests');
    const callsBeforeCache=scrub.calls;
    await page.evaluate(()=>window.__reader.move(0));await ready();
    assert.equal(await page.evaluate(()=>window.__scrubProbe.calls.length),callsBeforeCache,'A cached frame needs no extra native drawing');
    const callsBeforeRedraw=await page.evaluate(()=>window.__scrubProbe.calls.length);
    await page.getByRole('button',{name:'重画当前图',exact:true}).click();await page.waitForFunction(count=>window.__scrubProbe.calls.length>count,callsBeforeRedraw);await ready();
    await page.evaluate(()=>{window.__scrubProbe.observer.disconnect();window.chrome.webview.postMessage=window.__scrubProbe.send;});
    checks.smoothScrubbing={...scrub,cacheReused:true,explicitRedrawBypassesCache:true};
    await open('ch06/P43-1');await page.evaluate(()=>{const reader=window.__reader;reader.filter({chapter:'ch06',page:null,query:''});reader.mode('answer');while(reader.state.view.history.length)reader.back();reader.move(0);});await ready();
    await setTheme('深色');
    await delay(200);await page.getByLabel('章节',{exact:true}).click();await delay(180);
    assert(await page.locator('#chapter').evaluate(element=>element.matches(':open')));
    const colors=await page.locator('#chapter').evaluate(element=>({supported:CSS.supports('appearance','base-select'),popup:getComputedStyle(element,'::picker(select)').backgroundColor,options:[...element.options].map(option=>({color:getComputedStyle(option).color,background:getComputedStyle(option).backgroundColor}))}));
    assert(colors.supported);assert.notEqual(colors.popup,'rgb(255, 255, 255)');
    for(const option of colors.options){assert.notEqual(option.color,option.background);assert.notEqual(option.background,'rgb(255, 255, 255)');}
    const luminance=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    colors.minimumContrast=Math.min(...colors.options.map(option=>{const a=luminance(option.color),b=luminance(option.background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}));assert(colors.minimumContrast>=4.5);
    await page.screenshot({path:path.join(work,'studio-dark-select.png')});
    await page.getByRole('option',{name:/第1章/}).click();
    assert.equal(await page.getByLabel('章节',{exact:true}).inputValue(),'ch01');
    await page.getByLabel('章节',{exact:true}).click();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.getByLabel('章节',{exact:true}).inputValue(),'ch01');
    checks.themedChapterPicker={...colors,keyboardSelection:true};
    await setTheme('浅色');await delay(200);
    await open('ch06/P43-1');await page.evaluate(()=>window.__reader.filter({chapter:'ch06',page:null,query:''}));await page.getByRole('tab',{name:'答案',exact:true}).click();await ready();
    await page.evaluate(()=>{const reader=window.__reader;while(reader.state.view.history.length)reader.back();reader.move(0);reader.camera({zoom:null,x:0,y:0});});await ready();
    if(await page.getByRole('button',{name:'收藏当前题',exact:true}).count())await page.getByRole('button',{name:'收藏当前题',exact:true}).click();assert.equal(await page.getByRole('button',{name:'取消收藏',exact:true}).count(),1);checks.bookmarks=true;
    await page.getByRole('button',{name:'重画当前图',exact:true}).click();await ready();checks.explicitRedraw=true;
    await page.getByRole('button',{name:'专注模式',exact:true}).click();assert.equal(await page.locator('.sidebar').isVisible(),false);await page.keyboard.press('Escape');assert.equal(await page.locator('.sidebar').isVisible(),true);checks.focusMode=true;
    await open('ch03/P23-2-1');assert((await page.locator('.answer-card').innerText()).includes('W面 f'));await open('ch06/P43-1');await ready();checks.choiceAnswers=true;
    await page.screenshot({path:path.join(work,'studio-main.png')});
    await setTheme('深色');await delay(250);await page.screenshot({path:path.join(work,'studio-dark.png')});await setTheme('浅色');await delay(250);
    await page.setViewportSize({width:1000,height:740});await ready();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(work,'studio-compact.png')});checks.responsive=true;
    await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:940});await ready();checks.reducedMotion=true;
    assert.equal(errors.length,0,errors.join('\n'));
    fs.writeFileSync(path.join(output,'studio-selfcheck.json'),JSON.stringify({passed:true,framework:'React + WebView2',winui:false,checks,errors},null,2));
    fs.rmSync(path.join(work,'test-error.txt'),{force:true});
    console.log(JSON.stringify({passed:true,checks}));
  }
}catch(error){if(page)await page.screenshot({path:path.join(work,'studio-error.png')}).catch(()=>{});fs.writeFileSync(path.join(work,'test-error.txt'),String(error.stack));throw error;}
finally{
  if(page)await page.evaluate(()=>window.chrome.webview.postMessage({id:'close-test',type:'window',action:'close'})).catch(()=>{});
  await delay(1000);if(processHandle.exitCode===null)processHandle.kill();if(browser)await browser.close().catch(()=>{});fs.closeSync(log);
}
