type BridgeMessage={id:string; result:unknown; error:string|null};
type WebView={postMessage:(value:unknown)=>void; addEventListener:(event:string,listener:(event:{data:BridgeMessage})=>void)=>void};
declare global {interface Window {chrome?:{webview?:WebView}}}
const pending=new Map<string,{resolve:(value:unknown)=>void; reject:(reason:Error)=>void; timeout:ReturnType<typeof setTimeout>}>();
let counter=0;
window.chrome?.webview?.addEventListener('message',event=>{
  const {id,result,error}=event.data;const request=pending.get(id);if(!request)return;
  clearTimeout(request.timeout);pending.delete(id);
  if(error)request.reject(new Error(error));else request.resolve(result);
});
export function native<T>(type:string,details:Record<string,unknown>={}):Promise<T>{
  return new Promise((resolve,reject)=>{
    if(!window.chrome?.webview){reject(new Error('请使用桌面程序打开，以启用原始矢量绘图引擎。'));return;}
    const id=String(++counter);const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('绘图请求超时，请重试。'));},30000);
    pending.set(id,{resolve:resolve as (value:unknown)=>void,reject,timeout});
    window.chrome.webview.postMessage({id,type,...details});
  });
}
export function windowAction(action:string){void native('window',{action}).catch(()=>{});}
let startupReported=false;
export function reportReady(){if(startupReported)return;startupReported=true;void native('startupReady').catch(()=>{startupReported=false;});}
export const contentUrl=(path:string)=>'/content/'+path.split('/').map(encodeURIComponent).join('/');
