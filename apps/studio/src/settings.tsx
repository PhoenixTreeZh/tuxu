import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,ChevronRight,Heart,Info,Monitor,Moon,Sun,X} from 'lucide-react';
import {native} from './bridge';
import paymentCode from './assets/support_payment.jpg';
import appIcon from '../../../assets/brand/app-icon.svg';

export type Appearance='dark'|'light'|'system';
const labels:Record<Appearance,string>={dark:'深色',light:'浅色',system:'跟随系统'};

export function useAppearance(){
  const [appearance,setAppearance]=useState<Appearance>(()=>{
    const saved=localStorage.getItem('theme');
    return saved==='dark'||saved==='light'?saved:'system';
  });
  const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(()=>{
    const media=matchMedia('(prefers-color-scheme: dark)');
    const change=()=>setSystemDark(media.matches);
    media.addEventListener('change',change);change();
    return()=>media.removeEventListener('change',change);
  },[]);
  const dark=appearance==='system'?systemDark:appearance==='dark';
  useEffect(()=>{
    document.documentElement.dataset.theme=dark?'dark':'light';
    localStorage.setItem('theme',appearance);
    void native('theme',{dark}).catch(()=>{});
  },[appearance,dark]);
  return {appearance,setAppearance};
}

export function SettingsDialog({open,onClose,appearance,onAppearance}:{open:boolean;onClose:()=>void;appearance:Appearance;onAppearance:(value:Appearance)=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [page,setPage]=useState<'settings'|'appearance'|'support'|'about'>('settings');
  const title=page==='settings'?'设置':page==='appearance'?'外观':page==='support'?'支持我':'关于图序';
  useEffect(()=>{
    if(open){setPage('settings');if(!dialog.current?.open)dialog.current?.showModal();}
    else if(dialog.current?.open)dialog.current.close();
  },[open]);
  function back(){if(page==='settings')onClose();else setPage('settings');}
  return <dialog ref={dialog} className={'settings-dialog settings-'+page} aria-labelledby="settings-title"
    onCancel={event=>{event.preventDefault();back();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="settings-panel">
      <header className="settings-header">
        {page!=='settings'&&<button className="icon-button" aria-label="返回设置" onClick={()=>setPage('settings')}><ArrowLeft size={20}/></button>}
        <h2 id="settings-title">{title}</h2>
        <button className="icon-button settings-close" aria-label="关闭设置" onClick={onClose}><X size={20}/></button>
      </header>
      <div className="settings-body" key={page}>
        {page==='settings'?<>
          <p className="settings-intro">按你的习惯，安心看图。</p>
          <div className="settings-group">
            <button className="settings-entry" onClick={()=>setPage('appearance')}><span className="settings-entry-icon"><Monitor size={20}/></span><span><strong>外观</strong><small>选择阅读时的界面颜色</small></span><span className="settings-entry-value">{labels[appearance]}</span><ChevronRight size={17}/></button>
            <button className="settings-entry" onClick={()=>setPage('support')}><span className="settings-entry-icon"><Heart size={20}/></span><span><strong>支持我</strong><small>谢谢你对图序的支持</small></span><ChevronRight size={17}/></button>
            <button className="settings-entry" onClick={()=>setPage('about')}><span className="settings-entry-icon"><Info size={20}/></span><span><strong>关于图序</strong><small>软件信息与使用提示</small></span><ChevronRight size={17}/></button>
          </div>
          <footer className="settings-signature"><span className="signature-mark"><img src={appIcon} width={28} height={28} alt=""/></span><strong>图序 <span>· Windows 桌面版</span></strong><p>设计与开发 · PhoenixTree</p><span>问题反馈与建议</span><span className="feedback-email">phoenixtree_zh@163.com</span></footer>
        </>:page==='appearance'?<>
          <p className="settings-intro">切换外观时，保留当前题目和绘制进度。</p>
          <div className="appearance-options" role="radiogroup" aria-label="外观模式" onKeyDown={event=>{
            const options:Appearance[]=['dark','light','system'];
            const index=options.indexOf(appearance);
            const next=['ArrowDown','ArrowRight'].includes(event.key)?(index+1)%3:['ArrowUp','ArrowLeft'].includes(event.key)?(index+2)%3:event.key==='Home'?0:event.key==='End'?2:null;
            if(next===null)return;event.preventDefault();onAppearance(options[next]);event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next].focus();
          }}>
            {([{value:'dark',icon:Moon,description:'安静的深色界面'},{value:'light',icon:Sun,description:'清晰的浅色界面'},{value:'system',icon:Monitor,description:'随 Windows 的外观自动切换'}] as const).map(({value,icon:Icon,description})=><button key={value} role="radio" tabIndex={appearance===value?0:-1} aria-checked={appearance===value} className="appearance-option" onClick={()=>onAppearance(value)}><span className="appearance-icon"><Icon size={22}/></span><span><strong>{labels[value]}</strong><small>{description}</small></span><span className="appearance-check">{appearance===value&&<Check size={16}/>}</span></button>)}
          </div>
        </>:page==='support'?<>
          <div className="support-intro"><span className="support-heart"><Heart size={24}/></span><h3>谢谢你的支持</h3><p>如果图序帮到了你，欢迎请我喝杯咖啡。</p></div>
          <img className="support-payment" src={paymentCode} alt="PhoenixTree 的微信收款二维码"/>
          <p className="support-credit">PhoenixTree · 每一份支持，都是继续完善的动力。</p>
          <button className="settings-done" onClick={onClose}>完成</button>
        </>:<>
          <div className="about-brand"><img src={appIcon} width={48} height={48} alt="图序图标"/><h3>图序</h3><p>离线工程图学习题阅读器</p></div>
          <div className="about-information"><p><span>题库</span><strong>工程图学简明习题集 · 解题指导</strong></p><p><span>内容</span><strong>按章查题 · 单步绘制 · 图中详图</strong></p><p><span>设计与开发</span><strong>PhoenixTree</strong></p></div>
          <div className="about-help"><h3>看图小提示</h3><p>按住鼠标拖动画面，滚轮放大与缩小。</p><p>点击图中的可交互区域，查看局部细节。</p><p><kbd>←</kbd> <kbd>→</kbd> 翻步　<kbd>Esc</kbd> 返回上一图</p><p><kbd>Ctrl K</kbd> 搜索题号、页码或章节</p></div>
          <p className="about-feedback">问题反馈与建议<br/><span className="feedback-email">phoenixtree_zh@163.com</span></p>
        </>}
      </div>
    </div>
  </dialog>;
}
