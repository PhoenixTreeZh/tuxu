import type { Catalog, Filters, Question } from './types';

export const normalize=(value:string)=>value.normalize('NFKC').toUpperCase().replace(/[－—–]/g,'-').replace(/\s+/g,'').trim();
const strip=(value:string)=>value.replace(/^0+/,'')||'0';
const numeral=(value:string)=>({一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10}[value]??Number(value));

export class LibraryIndex {
  readonly catalog:Catalog;
  readonly byId:Map<string,Question>;
  readonly byPage=new Map<number,Set<string>>();
  readonly byChapter=new Map<string,Set<string>>();
  readonly byKey=new Map<string,Set<string>>();
  readonly text=new Map<string,string>();
  constructor(catalog:Catalog){
    this.catalog=catalog;
    this.byId=new Map(catalog.questions.map(q=>[q.id,q]));
    for(const q of catalog.questions){
      if(q.page!==null)this.add(this.byPage,q.page,q.id);
      this.add(this.byChapter,q.chapter,q.id);
      for(const key of [q.key,...q.aliases])this.add(this.byKey,normalize(key),q.id);
      const chapter=catalog.chapters.find(c=>c.id===q.chapter)!;
      this.text.set(q.id,normalize(q.key+q.title+chapter.title+q.aliases.join(' ')));
    }
  }
  private add<K>(map:Map<K,Set<string>>,key:K,id:string){if(!map.has(key))map.set(key,new Set());map.get(key)!.add(id);}
  search(filters:Partial<Filters>={},bookmarks:readonly string[]=[]):Question[]{
    let query=normalize(filters.query??'');
    let candidates:Set<string>|null=null;
    const restrict=(ids:Iterable<string>)=>{const set=new Set(ids);candidates=candidates===null?set:new Set([...candidates].filter(id=>set.has(id)));};
    if(filters.chapter&&filters.chapter!=='all')restrict(this.byChapter.get(filters.chapter)??[]);
    if(filters.page!==null&&filters.page!==undefined)restrict(this.byPage.get(filters.page)??[]);
    if(filters.bookmarks)restrict(bookmarks);
    const chapter=query.match(/第([一二三四五六七八九十]|\d+)章/);
    if(chapter){const id='ch'+String(numeral(chapter[1])).padStart(2,'0');restrict(this.byChapter.get(id)??[]);query=query.replace(chapter[0],'');}
    const page=query.match(/(?:第)?(\d+)页/);
    if(page){restrict(this.byPage.get(Number(page[1]))??[]);query=query.replace(page[0],'');}
    const question=query.match(/(?:第)?(\d+(?:-\d+)*)题/);
    if(question&&page){query='P'+strip(page[1])+'-'+question[1].split('-').map(strip).join('-');}
    const justPage=query.match(/^\d+$/);
    const key=query.match(/P?(\d+(?:-\d+)+)/);
    if(justPage){restrict(this.byPage.get(Number(query))??[]);query='';}
    if(key){
      const canonical='P'+key[1].split('-').map(strip).join('-');
      const ids=new Set<string>(this.byKey.get(canonical)??[]);
      for(const [label,items] of this.byKey)if(label.startsWith(canonical+'-'))for(const id of items)ids.add(id);
      if(!key[0].startsWith('P'))for(const q of this.catalog.questions){
        const title=normalize(q.key),number=canonical.slice(1);
        if(q.video&&title.startsWith(number)&&!/[0-9]/.test(title[number.length]??''))ids.add(q.id);
      }
      restrict(ids);query=query.replace(key[0],'');
    }
    const result=this.catalog.questions.filter(q=>(candidates===null||candidates.has(q.id))&&(!query||this.text.get(q.id)!.includes(query)));
    return result;
  }
}
