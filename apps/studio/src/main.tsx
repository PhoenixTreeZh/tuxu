import React,{memo,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {Command} from 'cmdk';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {ArrowLeft,ArrowRight,BookOpen,Bookmark,Box,Check,ChevronDown,ChevronRight,ChevronsLeft,ChevronsRight,CornerUpLeft,Expand,FileText,FolderOpen,Info,Keyboard,LoaderCircle,Maximize2,Minus,PanelLeftClose,PanelLeftOpen,Play,RotateCcw,Search,Settings,Square,Video,X,ZoomIn,ZoomOut} from 'lucide-react';
import '@fontsource-variable/geist';
import './style.css';
import './select.css';
import './reader-ui.css';
import {SettingsDialog,useAppearance} from './settings';
import appIcon from '../../../assets/brand/app-icon.svg';
import {reader} from './store';
import {contentUrl,native,reportReady,windowAction} from './bridge';
import {sceneImage} from './scene-images';
import type {SceneImage} from './scene-images';
import {SupersededTaskError} from './latest-task';
import type {Camera,Frame,Hotspot,Question,State} from './types';

gsap.registerPlugin(useGSAP);
const shortTitle=(title:string)=>title.replace(/^第\d+章/,'');
const caption=(q:Question)=>q.video?'操作视频':q.steps?`${q.steps} 步绘制`:q.detailCount?`${q.detailCount} 处可看详图`:'答案图';
function IconButton({label,children,onClick,disabled=false,active=false}:{label:string;children:React.ReactNode;onClick:()=>void;disabled?:boolean;active?:boolean}){
  return <button className={'icon-button'+(active?' is-active':'')} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}
const Sidebar=memo(function Sidebar({state,onSearch}:{state:State;onSearch:()=>void}){
  const {catalog,question,filters,matches,bookmarks}=state;
  const [expanded,setExpanded]=useState<Set<string>>(new Set());
  const list=useRef<HTMLElement>(null);
  useEffect(()=>{if(question)setExpanded(old=>new Set([...old,question.chapter+'/'+question.page]));},[question?.id]);
  useEffect(()=>{list.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest'});},[question?.id,expanded]);
  const visibleChapters=catalog?.chapters.filter(c=>matches.some(q=>q.chapter===c.id))??[];
  function toggle(key:string){setExpanded(old=>{const result=new Set(old);if(result.has(key))result.delete(key);else result.add(key);return result;});}
  return <aside className="sidebar" aria-label="题库目录">
    <div className="sidebar-intro"><span>工程图学简明习题集</span><span className="edition">解题指导</span></div>
    <button className="search-launcher" onClick={onSearch}><Search size={16}/><span>搜索题号、页码…</span><kbd>Ctrl K</kbd></button>
    <div className="library-tabs" role="tablist" aria-label="目录类型">
      <button role="tab" aria-selected={!filters.bookmarks} onClick={()=>reader.filter({bookmarks:false})}><BookOpen size={15}/>全部目录</button>
      <button role="tab" aria-selected={filters.bookmarks} onClick={()=>reader.filter({bookmarks:true})}><Bookmark size={15}/>收藏<span>{bookmarks.length||''}</span></button>
    </div>
    <div className="chapter-field"><label htmlFor="chapter">章节</label><div className="chapter-filter"><select id="chapter" aria-label="章节" value={filters.chapter} onChange={e=>reader.filter({chapter:e.target.value,page:null})}><option value="all" data-count={`${catalog?.questions.length??0} 题`}>全部章节</option>{catalog?.chapters.map((c,i)=><option key={c.id} value={c.id} data-count={`${c.count} 题`}>{c.id==='exercises'?'综合练习':`第${i+1}章 · ${shortTitle(c.title)}`}</option>)}</select></div></div>
    <div className="list-heading"><span>{matches.length} 道题目</span><select aria-label="筛选页码" value={filters.page??'all'} onChange={e=>reader.filter({page:e.target.value==='all'?null:Number(e.target.value)})}><option value="all">全部页</option>{[...new Set(catalog?.questions.filter(q=>filters.chapter==='all'||q.chapter===filters.chapter).map(q=>q.page).filter(p=>p!==null))].sort((a,b)=>a!-b!).map(p=><option key={p} value={p!}>第 {p} 页</option>)}</select></div>
    {filters.query&&<div className="search-filter"><Search size={13}/><span>{filters.query}</span><IconButton label="清除搜索" onClick={()=>reader.filter({query:''})}><X size={12}/></IconButton></div>}
    <nav className="index-tree" ref={list}>
      {!matches.length&&<div className="list-empty"><FolderOpen size={25}/><strong>{filters.bookmarks?'暂无符合条件的收藏':'没有找到题目'}</strong><p>试试其他章节、页码或题号。</p><button onClick={()=>reader.filter({chapter:'all',page:null,query:'',bookmarks:false})}>查看全部目录</button></div>}
      {visibleChapters.map(chapter=><section key={chapter.id} className="tree-chapter">
        {filters.chapter==='all'&&<h3>{chapter.title}</h3>}
        {chapter.pages.map(page=>{
          const items=matches.filter(q=>q.chapter===chapter.id&&q.page===page.number);if(!items.length)return null;
          const key=chapter.id+'/'+page.number;const open=expanded.has(key)||Boolean(filters.query)||filters.bookmarks;
          return <div className="tree-page" key={key}>
            <button className={'page-toggle'+(page.number===question?.page&&chapter.id===question.chapter?' current-page':'')} aria-expanded={open} onClick={()=>toggle(key)}><ChevronRight size={14} className={open?'rotated':''}/><span>{page.number===null?'绘图视频':`第 ${page.number} 页`}</span><small>{items.length}</small></button>
            {open&&<div className="page-questions">{items.map(q=><button key={q.id} data-question={q.id} aria-current={question?.id===q.id?'page':undefined} className="question-link" onClick={()=>void reader.open(q.id)}><span className="question-glyph">{q.video?<Video size={15}/>:q.steps?<Box size={15}/>:<FileText size={15}/>}</span><span><strong>{q.title}</strong><small>{caption(q)}</small></span>{bookmarks.includes(q.id)&&<Bookmark size={12}/>}</button>)}</div>}
          </div>;
        })}
      </section>)}
    </nav>
    <div className="sidebar-bottom"><div className="offline-note"><span className="status-dot"/>离线题库<span>{catalog?.chapters.length??10} 章 · {catalog?.questions.length??207} 题</span></div></div>
  </aside>;
},(a,b)=>a.state.catalog===b.state.catalog&&a.state.question===b.state.question&&a.state.filters===b.state.filters&&a.state.matches===b.state.matches&&a.state.bookmarks===b.state.bookmarks&&a.onSearch===b.onSearch);

function SearchDialog({open,onOpenChange,state}:{open:boolean;onOpenChange:(open:boolean)=>void;state:State}){
  const [query,setQuery]=useState('');
  useEffect(()=>{if(open)setQuery('');},[open]);
  const results=state.catalog?reader.index.search({query}):[];
  const recent=state.recent.map(id=>reader.index?.byId.get(id)).filter(Boolean) as Question[];
  const shown=query?results:recent;
  return <Command.Dialog open={open} onOpenChange={onOpenChange} label="搜索题目" shouldFilter={false}>
    <div className="command-search"><Search size={20}/><Command.Input value={query} onValueChange={setQuery} placeholder="输入 P43-1、43页，或第6章…"/><button aria-label="关闭搜索" onClick={()=>onOpenChange(false)}><kbd>Esc</kbd></button></div>
    <Command.List><Command.Empty>没有找到对应题目，试试页码或完整题号。</Command.Empty><Command.Group heading={query?`找到 ${results.length} 道题目`:'最近阅读'}>{shown.slice(0,60).map(q=><Command.Item key={q.id} value={q.id} onSelect={()=>{if(query)reader.filter({chapter:'all',page:null,query,bookmarks:false});else reader.filter({chapter:q.chapter,page:null,query:'',bookmarks:false});void reader.open(q.id);onOpenChange(false);}}><span className="command-icon">{q.video?<Video size={19}/>:<FileText size={19}/>}</span><span><strong>{q.title}</strong><small>{shortTitle(state.catalog!.chapters.find(c=>c.id===q.chapter)!.title)}{q.page!==null?` · 第 ${q.page} 页`:''}</small></span><span className="command-meta">{caption(q)}</span><CornerUpLeft size={14}/></Command.Item>)}</Command.Group></Command.List>
    <div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开题目</span><span>支持全角题号和章节检索</span></div>
  </Command.Dialog>;
}

function DrawingCanvas({state,focus,onFocus}:{state:State;focus:boolean;onFocus:()=>void}){
  const stage=useRef<HTMLDivElement>(null);
  const drawing=useRef<HTMLImageElement>(null);
  const paused=useRef<HTMLCanvasElement>(null);
  const [size,setSize]=useState({width:800,height:600});
  const [image,setImage]=useState<SceneImage|null>(null);
  const lastRequestedRevision=useRef(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const [showUpdating,setShowUpdating]=useState(false);
  const [hover,setHover]=useState<Hotspot|null>(null),[playing,setPlaying]=useState(true),[playRevision,setPlayRevision]=useState(0);
  const drag=useRef<{id:number;x:number;y:number;camera:Camera;moved:boolean}|null>(null);
  const frame=reader.frame();const animation=reader.animation();
  const camera=state.view.camera;
  const width=frame?.width??animation?.width??700,height=frame?.height??animation?.height??540;
  const zoom=camera.zoom??Math.max(.1,Math.min((size.width-32)/width,(size.height-32)/height,4));
  const zoomRef=useRef(zoom);zoomRef.current=zoom;
  const desiredScale=Math.max(.1,Math.min(16,zoom*devicePixelRatio));
  useLayoutEffect(()=>{const element=stage.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!frame){setImage(null);setBusy(false);return;}
    let active=true;setBusy(true);setError('');
    const force=lastRequestedRevision.current!==revision;lastRequestedRevision.current=revision;
    void sceneImage(frame.id,desiredScale,force).then(result=>{if(active){setImage(result);setBusy(false);}}).catch(error=>{
      if(active&&!(error instanceof SupersededTaskError)&&String(error)!=='Error: cancelled'){setError(String(error).replace(/^Error: /,''));setBusy(false);}
    });
    return()=>{active=false;};
  },[frame?.id,desiredScale,revision]);
  useEffect(()=>{setPlaying(true);setHover(null);},[frame?.id,animation?.id]);
  useEffect(()=>{if(!busy){setShowUpdating(false);return;}const timer=setTimeout(()=>setShowUpdating(true),160);return()=>clearTimeout(timer);},[busy]);
  function changeZoom(next:number,anchor?:{x:number;y:number}){
    const old=reader.state.view.camera;const ratio=Math.max(.1,Math.min(8,next));const point=anchor??{x:0,y:0};
    reader.camera({zoom:ratio,x:point.x-(point.x-old.x)*ratio/zoomRef.current,y:point.y-(point.y-old.y)*ratio/zoomRef.current});
  }
  useEffect(()=>{
    const element=stage.current;if(!element)return;
    const wheel=(event:WheelEvent)=>{if(state.document?.videoPath)return;event.preventDefault();const rect=element.getBoundingClientRect();changeZoom(zoomRef.current*Math.exp(-event.deltaY*.0015),{x:event.clientX-rect.left-rect.width/2,y:event.clientY-rect.top-rect.height/2});};
    element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
  },[state.document?.videoPath]);
  function local(event:{clientX:number;clientY:number}){const bounds=stage.current!.getBoundingClientRect();return{x:(event.clientX-bounds.left-bounds.width/2-camera.x)/zoom+width/2+(frame?.viewport[0]??0),y:(event.clientY-bounds.top-bounds.height/2-camera.y)/zoom+height/2+(frame?.viewport[1]??0)};}
  function hit(event:{clientX:number;clientY:number}){const point=local(event);return frame?.hotspots.find(h=>point.x>=h.rect[0]&&point.x<h.rect[2]&&point.y>=h.rect[1]&&point.y<h.rect[3])??null;}
  function pauseAnimation(){
    if(playing&&drawing.current&&paused.current){const ctx=paused.current.getContext('2d')!;paused.current.width=width;paused.current.height=height;ctx.drawImage(drawing.current,0,0,width,height);setPlaying(false);}
    else{setPlayRevision(n=>n+1);setPlaying(true);}
  }
  const isReady=Boolean(animation||frame&&image?.frame===frame.id&&!busy&&!error);
  const video=state.document?.videoPath;
  return <div className="canvas-shell" data-frame-id={frame?.id??animation?.id??''} data-displayed-frame-id={animation?.id??image?.frame??''} data-rendering={busy?'true':'false'} aria-busy={busy}>
    <div className="canvas-header">
    <div className="canvas-topline"><span>{state.view.detail?<><span className="canvas-breadcrumb">总图</span><ChevronRight size={12}/>{state.view.detail.label}</>:video?'绘图操作视频':'绘图工作区'}{Boolean(frame?.hotspots.length)&&<span className="canvas-click-hint">点击图上区域查看细节</span>}</span><div className="canvas-metadata"><span className="canvas-type">{busy&&image&&showUpdating?'更新中…':video?'视频':state.view.detail?.kind==='animation'?'模型动画':frame?.vector?'矢量绘图':'原始图稿'}</span>{Boolean(frame&&(frame.emptyLinks||frame.captions.length))&&<details className="source-information" key={frame?.id} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary aria-label="图稿信息" title="图稿信息"><Info size={15}/></summary><div><strong>图稿信息</strong>{frame?.captions.map((text,i)=><p key={i}>{text}</p>)}{Boolean(frame?.emptyLinks)&&<p>原稿含 {frame?.emptyLinks} 处空图引用。</p>}</div></details>}</div></div>
    {!video&&<div className="canvas-tools" role="toolbar" aria-label="画布工具">
      {(state.view.history.length>0||frame?.back)&&<><button className="back-tool" aria-label="返回上一图" onClick={()=>reader.back()}><CornerUpLeft size={16}/>返回</button><i/></>}
      <IconButton label="缩小" onClick={()=>changeZoom(zoom/1.2)} disabled={zoom<=.1}><ZoomOut size={17}/></IconButton>
      <button className="zoom-value" title="点击恢复适应窗口" onClick={()=>reader.camera({zoom:null,x:0,y:0})}>{Math.round(zoom*100)}%</button>
      <IconButton label="放大" onClick={()=>changeZoom(zoom*1.2)} disabled={zoom>=8}><ZoomIn size={17}/></IconButton><i/>
      <IconButton label="适应窗口" onClick={()=>reader.camera({zoom:null,x:0,y:0})}><Expand size={17}/></IconButton>
      <IconButton label="重画当前图" onClick={()=>setRevision(n=>n+1)} disabled={!frame}><RotateCcw size={16}/></IconButton>
      {animation&&<IconButton label={playing?'停止动画':'重播动画'} onClick={pauseAnimation}>{playing?<Square size={15}/>:<Play size={16}/>}</IconButton>}
      <i/><IconButton label={focus?'退出专注模式':'专注模式'} onClick={onFocus}><Maximize2 size={16}/></IconButton>
    </div>}
    </div>
    <div className={'drawing-stage'+(hover?' has-hotspot':'')} ref={stage}
      onPointerDown={event=>{if(event.button!==0||!(animation||image)||video)return;stage.current!.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,camera:{...camera,zoom},moved:false};}}
      onPointerMove={event=>{const active=drag.current;if(active&&active.id===event.pointerId){const x=event.clientX-active.x,y=event.clientY-active.y;if(Math.hypot(x,y)>4)active.moved=true;if(active.moved){setHover(null);reader.camera({...active.camera,x:active.camera.x+x,y:active.camera.y+y});}}else if(isReady)setHover(hit(event));}}
      onPointerUp={event=>{const active=drag.current;drag.current=null;if(stage.current?.hasPointerCapture(event.pointerId))stage.current.releasePointerCapture(event.pointerId);if(active&&!active.moved&&isReady){const target=hit(event);if(target)reader.hotspot(target);}}}
      onPointerCancel={()=>drag.current=null} onLostPointerCapture={()=>drag.current=null} onPointerLeave={()=>{if(!drag.current)setHover(null);}}>
      {video?<video key={video} controls preload="metadata" src={contentUrl(video)} aria-label="操作视频" onError={()=>setError('此旧视频格式暂不能直接播放，请使用原视频。')} onLoadedMetadata={()=>{setError('');reportReady();}}/>:<div className="scene" data-zoom={zoom} data-offset-x={camera.x} data-offset-y={camera.y} style={{width,height,transform:`translate(calc(-50% + ${camera.x}px),calc(-50% + ${camera.y}px)) scale(${zoom})`}}>
        {animation?<><img ref={drawing} key={animation.id+'/'+playRevision} src={contentUrl(animation.path)} alt="模型演示动画" width={width} height={height} hidden={!playing} onLoad={reportReady} draggable={false}/><canvas ref={paused} hidden={playing}/></>:image&&<img src={image.url} data-frame-id={image.frame} width={width} height={height} alt={state.question?.title+'绘图画面'} onLoad={reportReady} draggable={false}/>}
        {hover&&<div className="hotspot-outline" style={{left:hover.rect[0]-(frame?.viewport[0]??0),top:hover.rect[1]-(frame?.viewport[1]??0),width:hover.rect[2]-hover.rect[0],height:hover.rect[3]-hover.rect[1]}}/>}
      </div>}
      {busy&&!image&&!video&&<div className="canvas-loading"><LoaderCircle size={19}/><span>正在绘制</span></div>}
      {error&&<div className="canvas-error"><strong>画面暂未打开</strong><p>{error}</p><button onClick={()=>{if(video)stage.current?.querySelector('video')?.load();else setRevision(n=>n+1);}}>{video?'重试视频':'重新绘制'}</button>{video&&<button onClick={()=>void native('openVideo',{question:state.question?.id}).catch(error=>setError(String(error)))}>打开原视频</button>}</div>}
    </div>
    {!video&&<div className="canvas-footnote"><span>{hover?'点击打开'+hover.label:'按住拖动 · 滚轮缩放'}</span>{frame?.hotspots.length?<span>{frame.hotspots.length} 处可点击查看</span>:null}</div>}
    {Boolean(frame?.hotspots.length)&&<details className="accessible-details"><summary>图中详图</summary><div>{frame!.hotspots.map((h,i)=><button key={h.id} onClick={()=>reader.hotspot(h)}>{h.kind==='back'?'返回':h.label||`详图 ${i+1}`}<ChevronRight size={13}/></button>)}</div></details>}
  </div>;
}

function App(){
  const state=useSyncExternalStore(reader.subscribe,reader.snapshot);
  const [searchOpen,setSearchOpen]=useState(false),[focus,setFocus]=useState(false),[settingsOpen,setSettingsOpen]=useState(false);
  const {appearance,setAppearance}=useAppearance();
  const [notice,setNotice]=useState<{message:string;id:number}|null>(null);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),1800);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>setNotice(null),[state.question?.id,state.filters]);
  const navigateQuestion=React.useCallback((direction:number)=>{
    if(reader.state.loading)return;
    const index=reader.state.matches.findIndex(q=>q.id===reader.state.question?.id);
    const message=index<0?'当前题目不在筛选结果中':!reader.canQuestion(direction)?`已到当前筛选的${direction<0?'第一题':'最后一题'}`:'';
    if(message)setNotice({message,id:Date.now()});else{setNotice(null);void reader.question(direction);}
  },[]);
  const shell=useRef<HTMLDivElement>(null);
  const openSearch=React.useCallback(()=>setSearchOpen(true),[]);
  useEffect(()=>{void reader.init();},[]);
  useGSAP(()=>{const media=gsap.matchMedia();media.add('(prefers-reduced-motion: no-preference)',()=>{gsap.from('.sidebar-intro,.search-launcher,.library-tabs',{y:8,opacity:0,stagger:.06,duration:.3,ease:'power2.out'});});return()=>media.revert();},{scope:shell});
  useGSAP(()=>{if(!searchOpen)return;const media=gsap.matchMedia();media.add('(prefers-reduced-motion: no-preference)',()=>{gsap.from('[cmdk-dialog]',{y:-12,opacity:0,duration:.18,ease:'power2.out'});});return()=>media.revert();},{dependencies:[searchOpen]});
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{
    if(settingsOpen)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(open=>!open);return;}
    if(event.defaultPrevented)return;
    if(event.key==='Escape'&&(event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))return;
    if(event.key==='Escape'){if(searchOpen)return;if(focus){setFocus(false);return;}reader.back();return;}
    const target=event.target as HTMLElement;if(searchOpen||target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(event.key==='ArrowRight'){event.preventDefault();if(!reader.state.view.detail){if(reader.state.view.step<reader.sequence().length-1)reader.next();else navigateQuestion(1);}}else if(event.key==='ArrowLeft'){event.preventDefault();reader.move(reader.state.view.step-1);}else if(event.key==='Home'){event.preventDefault();reader.move(0);}else if(event.key==='End'){event.preventDefault();reader.move(reader.sequence().length-1);}
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[searchOpen,focus,settingsOpen,navigateQuestion]);
  const chapter=state.catalog?.chapters.find(c=>c.id===state.question?.chapter);
  const sequence=reader.sequence(),view=state.view,document=state.document;
  const end=view.step>=sequence.length-1;
  const hasPreviousStep=!view.detail&&!state.question?.video&&sequence.length>1&&view.step>0;
  const hasNextStep=!view.detail&&!state.question?.video&&sequence.length>1&&!end;
  const frame=reader.frame();
  return <div ref={shell} className={'app-shell overflow-x-hidden w-full max-w-full'+(focus?' focus-mode':'')}>
    <header className="app-bar" onPointerDown={event=>{if(event.button===0&&!(event.target as HTMLElement).closest('button,input,select'))windowAction('drag');}} onDoubleClick={event=>{if(!(event.target as HTMLElement).closest('button'))windowAction('maximize');}}><div className="brand-mark"><img src={appIcon} width={24} height={24} alt=""/><strong>图序</strong><span>工程图学阅读器</span></div><div className="bar-right"><span className="library-local"><span className="status-dot"/>本地题库</span><IconButton label="设置" active={settingsOpen} onClick={()=>{setSearchOpen(false);setSettingsOpen(true);}}><Settings size={19}/></IconButton><div className="window-buttons"><IconButton label="最小化" onClick={()=>windowAction('minimize')}><Minus size={15}/></IconButton><IconButton label="最大化" onClick={()=>windowAction('maximize')}><Square size={12}/></IconButton><IconButton label="关闭窗口" onClick={()=>windowAction('close')}><X size={17}/></IconButton></div></div></header>
    <Sidebar state={state} onSearch={openSearch}/>
    <main className="workspace">
      <div className="reader-toolbar">
        <div className="reader-heading"><h1 title={state.question?.title}>{state.question?.title??'工程图学'}</h1><div className="breadcrumbs"><button onClick={()=>reader.filter({chapter:state.question?.chapter??'all',page:null,query:'',bookmarks:false})}>{chapter?shortTitle(chapter.title):'工程图学'}</button><ChevronRight size={12}/><button onClick={()=>reader.filter({page:state.question?.page??null})}>{state.question?.page!==null?`第 ${state.question?.page??'—'} 页`:'视频教学'}</button></div></div>
        <div className="reader-modebar"><div className="mode-tabs" role="tablist" aria-label="题目视图">{([{id:'answer',label:state.question?.video?'视频':'答案',enabled:true},{id:'question',label:'题图',enabled:Boolean(document?.questionFrames.length)},{id:'supplement',label:'补充图',enabled:Boolean(document?.supplementFrames.length)}] as const).filter(tab=>tab.enabled).map(tab=><button key={tab.id} role="tab" aria-selected={view.mode===tab.id} onClick={()=>reader.mode(tab.id)}>{tab.label}</button>)}</div>{document&&view.mode==='answer'&&document.branches.length>1&&<select aria-label="答案内容" value={view.branch} onChange={e=>reader.branch(e.target.value)}>{document.branches.map(b=><option key={b.id} value={b.id}>{b.label} · {b.frames.length}{b.kind==='steps'?' 步':' 张'}</option>)}</select>}</div>
        <div className="heading-actions"><IconButton label={focus?'显示目录':'隐藏目录'} onClick={()=>setFocus(!focus)}>{focus?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</IconButton><IconButton label={state.bookmarks.includes(state.question?.id??'')?'取消收藏':'收藏当前题'} active={state.bookmarks.includes(state.question?.id??'')} onClick={()=>reader.bookmark()}><Bookmark size={19}/></IconButton></div>
      </div>
      <div className="reading-surface">{state.loading?<div className="document-loading"><LoaderCircle size={24}/><p>正在打开题目</p></div>:state.error?<div className="document-error"><strong>题目暂未打开</strong><p>{state.error}</p><button onClick={()=>state.question&&void reader.open(state.question.id)}>重试</button></div>:document?<DrawingCanvas state={state} focus={focus} onFocus={()=>setFocus(!focus)}/>:<div className="document-loading">从目录选择一道题目</div>}</div>
      {document?.answer&&view.mode==='answer'&&!view.detail&&<div className="answer-card"><span><Check size={15}/>参考答案</span><p>{document.answer}</p></div>}
      <footer className="reading-transport">
        {notice&&<div className="navigation-notice" role="status" aria-live="polite" key={notice.id}>{notice.message}</div>}
        <div className="transport-context">{!state.question?.video&&!view.detail&&sequence.length>1?<><IconButton label="从头看" onClick={()=>reader.move(0)} disabled={view.step===0}><ChevronsLeft size={17}/></IconButton><div className="step-progress"><span><strong>{view.step+1}</strong> / {sequence.length}</span><input aria-label="绘制步骤" type="range" min={0} max={sequence.length-1} value={view.step} onChange={e=>reader.move(Number(e.target.value))}/></div><IconButton label="最终答案" onClick={()=>reader.move(sequence.length-1)} disabled={end}><ChevronsRight size={17}/></IconButton></>:view.detail?<><button className="detail-return" onClick={()=>reader.back()}><CornerUpLeft size={15}/>返回上一图</button><span className="transport-hint">{view.detail.label}</span><button className="detail-return" onClick={()=>{while(reader.state.view.history.length)reader.back();}}>回到总图</button></>:<span className="transport-hint">{state.question?.video?'使用视频控件查看绘图过程':frame?.hotspots.length?'点击图上区域查看细节':'完整图稿'}</span>}</div>
        <div className="navigation-buttons" aria-label="题目与步骤导航">
          <button className={'reader-button'+(!hasPreviousStep?' span-two':'')} aria-label="上一题" onClick={()=>navigateQuestion(-1)} disabled={!document||state.loading}><ChevronsLeft size={18}/><span>上一题</span></button>
          {hasPreviousStep&&<button className="reader-button" aria-label="上一步" onClick={()=>reader.move(view.step-1)} disabled={state.loading}><ArrowLeft size={18}/><span>上一步</span></button>}
          {hasNextStep&&<button className="reader-button reader-button-primary" aria-label="下一步" onClick={()=>reader.next()} disabled={state.loading}><span>下一步</span><ArrowRight size={18}/></button>}
          <button className={'reader-button'+(!hasNextStep?' span-two reader-button-primary':'')} aria-label="下一题" onClick={()=>navigateQuestion(1)} disabled={!document||state.loading}><span>下一题</span><ChevronsRight size={18}/></button>
        </div>
      </footer>
      <div className="reader-caption"><span>{frame?.captions.join(' ')||'工程图学简明习题集 · 解题指导'}</span><span className="keyboard-hint"><Keyboard size={13}/>← → 翻步<span>Esc 返回</span></span></div>
    </main>
    <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} state={state}/>
    <SettingsDialog open={settingsOpen} onClose={()=>setSettingsOpen(false)} appearance={appearance} onAppearance={setAppearance}/>
  </div>;
}

if(new URLSearchParams(location.search).has('test'))Object.assign(window,{__reader:reader});
createRoot(document.getElementById('root')!).render(<App/>);
