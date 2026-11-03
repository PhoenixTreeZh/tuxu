import type {Camera,Catalog,Detail,Document,Filters,Hotspot,Mode,State,View} from './types';
import {LibraryIndex} from './catalog';
import {contentUrl} from './bridge';

const fresh=(mode:Mode='answer',branch=''):View=>({mode,branch,step:0,detail:null,history:[],camera:{zoom:null,x:0,y:0}});
function read<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)??'null')??fallback;}catch{return fallback;}}
type Session={mode:Mode; branch:string; views:Map<string,View>};
export class ReaderStore {
  index!:LibraryIndex;
  private listeners=new Set<()=>void>();
  private documents=new Map<string,Promise<Document>>();
  private sessions=new Map<string,Session>();
  private version=0;
  state:State={catalog:null,question:null,document:null,view:fresh(),filters:{chapter:'all',page:null,query:'',bookmarks:false},matches:[],loading:true,error:null,bookmarks:read('bookmarks',[]),recent:read('recent',[])};
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  snapshot=()=>this.state;
  private update(patch:Partial<State>){this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());}
  async init(){try{
    const response=await fetch(contentUrl('index/catalog.json'));if(!response.ok)throw new Error('目录读取失败');
    const catalog=await response.json() as Catalog;this.index=new LibraryIndex(catalog);
    const id=catalog.questions[0]?.id;if(!id)throw new Error('题库没有可打开的题目');
    this.update({catalog,filters:{chapter:'all',page:null,query:'',bookmarks:false}});this.filter({});await this.open(id);
  }catch(error){this.update({loading:false,error:String(error)});}}
  filter(patch:Partial<Filters>){const filters={...this.state.filters,...patch};this.update({filters,matches:this.index.search(filters,this.state.bookmarks)});}
  private key(view:View){return view.mode==='answer'?'answer/'+view.branch:view.mode;}
  private save(){const {question,document,view}=this.state;if(!question||!document)return;
    let session=this.sessions.get(question.id);if(!session){session={mode:view.mode,branch:view.branch,views:new Map()};this.sessions.set(question.id,session);}
    session.mode=view.mode;session.branch=view.branch;session.views.set(this.key(view),structuredClone(view));
  }
  private restore(document:Document,mode:Mode,branch:string){
    if(mode==='question'&&!document.questionFrames.length||mode==='supplement'&&!document.supplementFrames.length)mode='answer';
    if(!document.branches.some(b=>b.id===branch))branch=document.branches[0]?.id??'';
    const session=this.sessions.get(document.question.id);
    const restored=structuredClone(session?.views.get(mode==='answer'?'answer/'+branch:mode)??fresh(mode,branch));
    // Question/supplement views share one cache each, while the selected answer
    // branch remains the live branch chosen by the reader.
    restored.branch=branch;
    return restored;
  }
  async open(id:string){
    const question=this.index.byId.get(id);if(!question)return;
    if(this.state.question?.id===id&&this.state.document)return;
    this.save();const token=++this.version;this.update({question,document:null,loading:true,error:null});
    try{
      if(!this.documents.has(id))this.documents.set(id,fetch(contentUrl(question.dataPath)).then(r=>{if(!r.ok)throw new Error('题目读取失败');return r.json() as Promise<Document>;}));
      const document=await this.documents.get(id)!;if(token!==this.version)return;
      const session=this.sessions.get(id);const view=this.restore(document,session?.mode??'answer',session?.branch??'');
      const recent=[id,...this.state.recent.filter(q=>q!==id)].slice(0,12);
      this.update({document,view,loading:false,recent});localStorage.setItem('recent',JSON.stringify(recent));
    }catch(error){this.documents.delete(id);if(token===this.version)this.update({loading:false,error:String(error)});}
  }
  mode(mode:Mode){const document=this.state.document;if(!document||mode===this.state.view.mode)return;this.save();this.update({view:this.restore(document,mode,this.state.view.branch)});}
  branch(branch:string){const document=this.state.document;if(!document||branch===this.state.view.branch)return;this.save();this.update({view:this.restore(document,'answer',branch)});}
  sequence(){const {document,view}=this.state;if(!document)return[];return view.mode==='question'?document.questionFrames:view.mode==='supplement'?document.supplementFrames:document.branches.find(b=>b.id===view.branch)?.frames??[];}
  frame(){const {document,view}=this.state;if(!document||view.detail?.kind==='animation')return null;return document.frames[view.detail?.id??this.sequence()[view.step]]??null;}
  animation(){return this.state.view.detail?.kind==='animation'?this.state.document?.animations[this.state.view.detail.id]??null:null;}
  move(step:number){if(this.state.view.detail)return;const sequence=this.sequence();if(!sequence.length)return;this.update({view:{...this.state.view,step:Math.max(0,Math.min(sequence.length-1,step))}});}
  next(){if(this.state.view.detail||!this.sequence().length)return;if(this.state.view.step<this.sequence().length-1)this.move(this.state.view.step+1);else void this.question(1);}
  canQuestion(direction:number){const index=this.state.matches.findIndex(q=>q.id===this.state.question?.id);return direction<0?index>0:index<this.state.matches.length-1;}
  async question(direction:number){if(!this.canQuestion(direction))return;const index=this.state.matches.findIndex(q=>q.id===this.state.question?.id);await this.open(this.state.matches[index+(direction>0?1:-1)].id);}
  camera(camera:Camera){this.update({view:{...this.state.view,camera}});}
  hotspot(hotspot:Hotspot){
    if(hotspot.kind==='back'){this.back();return;}
    const detail:Detail=hotspot.kind==='animation'?{kind:'animation',id:hotspot.target_animation_id!,label:hotspot.label}:{kind:'frame',id:hotspot.target_frame_id!,label:hotspot.label};
    const view=this.state.view;this.update({view:{...view,detail,history:[...view.history,{detail:view.detail,camera:view.camera}],camera:{zoom:null,x:0,y:0}}});
  }
  back(){const view=this.state.view;const history=[...view.history];const visit=history.pop();
    if(visit){this.update({view:{...view,...visit,history}});return;}
    const target=this.frame()?.back;if(!target)return;
    const index=this.sequence().indexOf(target);this.update({view:{...view,detail:index>=0?null:{kind:'frame',id:target,label:'上一图'},step:index>=0?index:view.step,camera:{zoom:null,x:0,y:0}}});
  }
  bookmark(){const id=this.state.question?.id;if(!id)return;const bookmarks=this.state.bookmarks.includes(id)?this.state.bookmarks.filter(q=>q!==id):[...this.state.bookmarks,id];this.update({bookmarks});localStorage.setItem('bookmarks',JSON.stringify(bookmarks));this.filter({});}
}
export const reader=new ReaderStore();
