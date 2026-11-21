import test from 'node:test';
import assert from 'node:assert/strict';
import {train, dataset, predictions, pixels, probability} from './model.js';
import {binsFor, nll, fitTemperature} from './calibration/metrics.js';
import {transform, combine, shiftRight, magnitudeChanges} from './fourier/fft.js';

test('training interventions keep shape-channel pixels and samples fixed', () => {
  const first = dataset('train',95), second = dataset('train',50);
  assert.equal(first.filter(x => x.color === x.label).length,380);
  assert.equal(second.filter(x => x.color === x.label).length,200);
  assert.ok(first.every((sample,i) => sample.id === second[i].id &&
    pixels(sample).every((value,j) => j%2 || value === pixels(second[i])[j])));
});

test('deterministic convolution training exhibits the documented group shift', () => {
  const weights = train(95);
  assert.deepEqual(train(95),weights);
  const baseline = predictions(weights,'test',50);
  const after = predictions(train(50),'test',50);
  const minority = records => records.filter(x => x.sample.color !== x.sample.label && x.correct).length;
  assert.ok(minority(after) > minority(baseline) + 80);
});

test('validation fit lowers validation NLL and positive temperature preserves classifications', () => {
  const weights = train(95);
  const validation = predictions(weights,'validation',90), testSet = predictions(weights,'test',5);
  const t = fitTemperature(validation);
  assert.ok(t > 1.1 && nll(validation,t) <= nll(validation,1));
  for (const row of testSet) assert.equal(probability(row.logit,t)>=.5,row.logit>=0);
  const bins = binsFor(testSet,t);
  assert.equal(bins.reduce((n,b)=>n+b.count,0),400);
  assert.equal(bins.reduce((n,b)=>n+b.correct,0),testSet.filter(x=>x.correct).length);
});

test('FFT round-trip and same-image spectral recombination recover pixels', () => {
  const image = Float64Array.from({length:64},(_,i)=>Math.sin(i)*64+i%9);
  const spectrum = transform(image,8);
  for (const candidate of [transform(spectrum.re,8,spectrum.im,true).re,combine(spectrum,spectrum,8)]) {
    assert.ok(candidate.every((v,i) => Math.abs(v-image[i])<1e-9));
  }
});

test('a cyclic shift preserves amplitude and changes the expected phase', () => {
  const image = Float64Array.from({length:64},(_,i)=>Number(i===0));
  const shifted = shiftRight(image,8,3);
  assert.equal(shifted[3],1);
  const base = transform(image,8), moved = transform(shifted,8);
  assert.ok(magnitudeChanges(base,moved)<1e-12);
  assert.ok(Math.abs(Math.atan2(moved.im[1],moved.re[1]) + 3*Math.PI/4)<1e-12);
});
