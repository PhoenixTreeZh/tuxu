// No --test, no debugging port and no WebView environment overrides.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.env.STUDIO_OUTPUT||path.join(root,'apps/desktop/bin/Release/net10.0-windows/win-x64');
const work=path.join(root,'_rea_temp/startup-audit');fs.mkdirSync(work,{recursive:true});
const statusFile=path.join(output,'startup-status.json');
const environment={...process.env};
for(const key of Object.keys(environment))if(key.startsWith('WEBVIEW2_'))delete environment[key];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
for(const attempt of [1,2]){
    const started=Date.now();
    const child=spawn(path.join(output,'DrawingStudio.exe'),[],{cwd:attempt===1?work:root,env:environment,windowsHide:true,stdio:'ignore'});
    try{
        let status=null;
        for(let check=0;check<100;check++){
            assert.equal(child.exitCode,null,'Normal launch exited before its first drawing was visible.');
            if(fs.existsSync(statusFile)){
                try{const candidate=JSON.parse(fs.readFileSync(statusFile,'utf8'));if(candidate.pid===child.pid&&Date.parse(candidate.startedUtc)>=started-1000)status=candidate;}catch{}
            }
            if(status?.phase==='failed')throw new Error('Normal startup failed; see startup-error.txt: '+JSON.stringify(status));
            if(status?.phase==='ready')break;
            await delay(150);
        }
        assert.equal(status?.phase,'ready','Normal launch did not confirm a decoded drawing: '+JSON.stringify(status));
        assert.equal(status.testMode,false);assert.equal(status.debugPortEnabled,false);
        assert.equal(status.frames,1316);
        assert.equal(child.exitCode,null);
        results.push({attempt,passed:true,pid:child.pid,firstDrawingVisible:true,elapsedMs:Date.now()-started,profile:status.profile,testMode:false,debugPortEnabled:false,differentWorkingDirectory:true});
    }finally{
        if(child.exitCode===null){child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(2000)]);}
    }
}
const report={passed:true,normalLaunches:results,scope:'Direct executable launch without test flags or WebView overrides; real image-load notification required.'};
fs.writeFileSync(path.join(output,'normal-startup-verification.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(work,'normal-startup-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
