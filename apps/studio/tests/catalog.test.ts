import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LibraryIndex} from '../src/catalog.ts';
import {catalog} from './fixtures/catalog.ts';
const index=new LibraryIndex(catalog);
const ids=(query:string,chapter='all')=>index.search({query,chapter}).map(q=>q.id);
test('chapter/page hierarchy contains every visible entry exactly once',()=>{
  assert.equal(index.byId.size,24);assert.equal(catalog.questions.filter(q=>q.steps).length,2);
  const entries=catalog.chapters.flatMap(c=>c.pages.flatMap(p=>p.questions));assert.equal(new Set(entries).size,24);assert.equal(entries.length,24);
});
test('exact numbers, normalized full-width input and very large input',()=>{
  assert.deepEqual(ids('Ｐ００２－０１'),['ch01/P2-1']);assert.deepEqual(ids('P2-1'),['ch01/P2-1']);
  assert.equal(ids('9'.repeat(100)).length,0);assert.equal(ids('P'+'9'.repeat(100)+'-1').length,0);
  assert.equal(ids('P23-1').length,7);assert.equal(ids('P23-1-1').length,1);
});
test('page and natural chapter/page/question expressions',()=>{
  assert.deepEqual(ids('第六章 第43页 第1题'),['ch06/P43-1']);
  assert.deepEqual(ids('第3章 P16-6'),['ch03/P16-6']);
  assert.equal(ids('43页').length,1);assert.equal(ids('第6章').length,2);
  assert.deepEqual(ids('机械图 P43-1'),['ch06/P43-1']);assert.deepEqual(ids('P16-6 组合体'),['ch03/P16-6']);
});
test('source detail aliases point to the merged root, not duplicate entries',()=>{
  assert.deepEqual(ids('P1-4'),['ch01/P1']);assert.deepEqual(ids('P44-3'),['ch06/P44']);assert(!index.byId.has('ch06/P44-3'));
});
test('video lesson numbers do not collide with explicit page-question notation',()=>{
  assert.equal(ids('7-1','ch07').length,2);assert.equal(ids('P7-1','ch07').length,0);
  assert.equal(ids('7-2','ch07').length,2);assert.equal(ids('7-3','ch07').length,2);
});
test('page/chapter/bookmark intersections respect all constraints',()=>{
  assert.equal(index.search({chapter:'ch03',page:16}).length,6);
  assert.equal(index.search({chapter:'ch06',page:16}).length,0);
  assert.deepEqual(index.search({bookmarks:true},['ch06/P43-1']).map(q=>q.id),['ch06/P43-1']);
});
