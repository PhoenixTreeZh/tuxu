// Synthetic search metadata. No source-book text, drawings or answer data.
import type {Catalog,Question} from '../../src/types.ts';
const question=(chapter:string,page:number|null,key:string,extra:Partial<Question>={}):Question=>({
  id:chapter+'/'+key,chapter,page,key,title:'检索示例 '+key,aliases:[],steps:0,video:false,detailCount:0,dataPath:'demo/'+key+'.json',...extra,
});
const questions:Question[]=[
  question('ch01',1,'P1',{aliases:['P1-1','P1-2','P1-3','P1-4']}),
  question('ch01',2,'P2-1',{steps:3}),question('ch01',2,'P2-2',{steps:4}),
  ...Array.from({length:6},(_,i)=>question('ch03',16,`P16-${i+1}`)),
  ...Array.from({length:7},(_,i)=>question('ch03',23,`P23-1-${i+1}`)),
  question('ch06',43,'P43-1'),question('ch06',44,'P44',{aliases:['P44-1','P44-2','P44-3']}),
  ...[1,2,3].flatMap(n=>['操作示例','讲解示例'].map(label=>question('ch07',null,`7-${n}${label}`,{video:true}))),
];
const chapters=[['ch01','第1章 基础示例'],['ch03','第3章 组合体示例'],['ch06','第6章 机械图示例'],['ch07','第7章 视频示例']].map(([id,title])=>{
  const items=questions.filter(q=>q.chapter===id);
  return{id,title,count:items.length,pages:[...new Set(items.map(q=>q.page))].map(number=>({number,questions:items.filter(q=>q.page===number).map(q=>q.id)}))};
});
export const catalog:Catalog={version:1,librarySha256:'synthetic-fixture',chapters,questions};
