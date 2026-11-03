import {native} from './bridge';
import {LatestTaskQueue,WeightedCache} from './latest-task';
export type SceneImage={frame:string;url:string;decoded:HTMLImageElement};
const cache=new WeightedCache<SceneImage>(64*1024*1024);
const queue=new LatestTaskQueue<SceneImage>();

export function sceneImage(frame:string,scale:number,force=false):Promise<SceneImage>{
  const key=frame+'@'+String(scale);
  const cached=force?undefined:cache.get(key);if(cached){queue.clearWaiting();return Promise.resolve(cached);}
  return queue.request(async()=>{
    const existing=force?undefined:cache.get(key);if(existing)return existing;
    const result=await native<{png:string;width:number;height:number}>('render',{frame,scale});
    const url='data:image/png;base64,'+result.png;
    const decoded=new Image();decoded.src=url;await decoded.decode();
    const image={frame,url,decoded};cache.set(key,image,result.width*result.height*4+url.length*2);
    return image;
  });
}
