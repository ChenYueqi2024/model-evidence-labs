import test from 'node:test';
import assert from 'node:assert/strict';
import {documents, tasks} from './corpus.js';
import {chunksOf, rank, chooseContext, evidenceCoverage, promptFor} from './engine.js';

const paragraphs = chunksOf(documents,'paragraph');
const [loan,renew,hop,sample] = tasks;
test('BM25 can find a newer rule and still retrieve an archived version', () => {
  const ranked = rank(loan.query,paragraphs,'bm25',false);
  assert.deepEqual(ranked.slice(0,2).map(c=>c.id),['current-1','archive-1']);
  const cut = chooseContext(ranked,3,430,new Set(['current-1']));
  assert.equal(cut.context.some(c=>c.doc==='archive'),true);
  assert.deepEqual(evidenceCoverage(cut.context,loan),[null]);
  assert.ok(!promptFor(loan.query,cut.context).includes('seven calendar days'));
});

test('both evidence spans are required for cross-document questions', () => {
  const ranked = rank(hop.query,paragraphs,'bm25',false);
  assert.equal(evidenceCoverage(chooseContext(ranked,1,430).context,hop).filter(Boolean).length,1);
  assert.equal(evidenceCoverage(chooseContext(ranked,3,430).context,hop).filter(Boolean).length,2);
  const tiny=chooseContext(ranked,3,60);
  assert.equal(tiny.candidates.some(c=>c.status==='budget'),true);
  assert.ok(tiny.used<=60);
});

test('granularity and term expansion have measurable ranking effects', () => {
  const sentences = chunksOf(documents,'sentence');
  assert.ok(sentences.length>paragraphs.length);
  assert.equal(evidenceCoverage(sentences,renew).filter(Boolean).length,2);
  assert.notEqual(rank(sample.query,paragraphs,'bm25',false)[0].doc,'room');
  assert.equal(rank(sample.query,paragraphs,'bm25',true)[0].doc,'room');
  assert.deepEqual(rank('xyzxyzxyz',paragraphs,'bm25',false),[]);
});
