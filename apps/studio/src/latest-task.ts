export class SupersededTaskError extends Error {
  constructor(){super('superseded');this.name='SupersededTaskError';}
}
type Job<T>={run:()=>Promise<T>;resolve:(result:T)=>void;reject:(error:unknown)=>void};

/** One expensive job at a time; only the latest waiting request survives. */
export class LatestTaskQueue<T> {
  private running=false;
  private waiting:Job<T>|null=null;
  clearWaiting(){this.waiting?.reject(new SupersededTaskError());this.waiting=null;}
  request(run:()=>Promise<T>):Promise<T>{
    return new Promise((resolve,reject)=>{
      this.waiting?.reject(new SupersededTaskError());this.waiting={run,resolve,reject};
      if(!this.running)void this.drain();
    });
  }
  private async drain(){
    this.running=true;
    while(this.waiting){
      const job=this.waiting;this.waiting=null;
      try{job.resolve(await job.run());}catch(error){job.reject(error);}
    }
    this.running=false;
  }
}

export class WeightedCache<T> {
  private entries=new Map<string,{value:T;cost:number}>();
  private bytes=0;
  private readonly limit:number;
  private readonly maxEntries:number;
  constructor(limit:number,maxEntries=24){this.limit=limit;this.maxEntries=maxEntries;}
  get(key:string):T|undefined{
    const entry=this.entries.get(key);if(!entry)return;
    this.entries.delete(key);this.entries.set(key,entry);return entry.value;
  }
  set(key:string,value:T,cost:number){
    const old=this.entries.get(key);if(old){this.bytes-=old.cost;this.entries.delete(key);}
    if(cost>this.limit)return;
    this.entries.set(key,{value,cost});this.bytes+=cost;
    while(this.bytes>this.limit||this.entries.size>this.maxEntries){
      const oldest=this.entries.keys().next().value!;this.bytes-=this.entries.get(oldest)!.cost;this.entries.delete(oldest);
    }
  }
}
