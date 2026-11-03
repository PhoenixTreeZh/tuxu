import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LatestTaskQueue,SupersededTaskError,WeightedCache} from '../src/latest-task.ts';

test('rapid requests execute only the running job and the newest queued job',async()=>{
  const queue=new LatestTaskQueue<number>();const executed:number[]=[];
  let finish!:(value:number)=>void;
  const first=queue.request(()=>{executed.push(1);return new Promise<number>(resolve=>finish=resolve);});
  const middle=queue.request(async()=>{executed.push(2);return 2;});
  const rejected=assert.rejects(middle,SupersededTaskError);
  const latest=queue.request(async()=>{executed.push(3);return 3;});
  finish(1);assert.equal(await first,1);assert.equal(await latest,3);await rejected;
  assert.deepEqual(executed,[1,3]);
});
test('a cached latest frame can discard an obsolete waiting render',async()=>{
  const queue=new LatestTaskQueue<number>();let finish!:(value:number)=>void;let obsoleteRan=false;
  const running=queue.request(()=>new Promise<number>(resolve=>finish=resolve));
  const waiting=queue.request(async()=>{obsoleteRan=true;return 2;});const rejected=assert.rejects(waiting,SupersededTaskError);
  queue.clearWaiting();finish(1);await running;await rejected;assert.equal(obsoleteRan,false);
});
test('failed drawing does not block a later request',async()=>{
  const queue=new LatestTaskQueue<number>();await assert.rejects(queue.request(async()=>{throw new Error('failed');}));
  assert.equal(await queue.request(async()=>7),7);
});
test('decoded-frame cache respects its byte budget and least-recently-used order',()=>{
  const cache=new WeightedCache<string>(10,3);cache.set('a','A',4);cache.set('b','B',4);assert.equal(cache.get('a'),'A');
  cache.set('c','C',4);assert.equal(cache.get('b'),undefined);assert.equal(cache.get('a'),'A');assert.equal(cache.get('c'),'C');
  cache.set('large','oversized',11);assert.equal(cache.get('large'),undefined);
});
