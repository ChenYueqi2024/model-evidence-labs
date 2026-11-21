import {probability} from '../model.js';

export function binsFor(records, temperature) {
  const bins = Array.from({length:10}, (_, i) => ({
    min:.5 + .05 * i, max:.5 + .05 * (i + 1), rows:[], correct:0, totalConfidence:0
  }));
  for (const row of records) {
    const confidence = probability(Math.abs(row.logit), temperature);
    const bucket = bins[Math.min(9, Math.floor((confidence - .5) * 20 + 1e-12))];
    bucket.rows.push(row);
    bucket.correct += Number(row.correct);
    bucket.totalConfidence += confidence;
  }
  return bins.map(bin => ({...bin, count:bin.rows.length,
    accuracy:bin.rows.length ? bin.correct / bin.rows.length : null,
    confidence:bin.rows.length ? bin.totalConfidence / bin.rows.length : null}));
}

export function nll(records, temperature) {
  return records.reduce((sum, {logit, sample}) => {
    const z = (sample.label ? -logit : logit) / temperature;
    return sum + Math.max(0, z) + Math.log1p(Math.exp(-Math.abs(z)));
  }, 0) / records.length;
}

export function fitTemperature(records) {
  // NLL is convex in inverse temperature. Bisect its derivative on the UI range.
  let low = 1 / 12, high = 1 / .15;
  for (let i = 0; i < 50; i++) {
    const inverse = (low + high) / 2;
    const slope = records.reduce((sum, {logit, sample}) =>
      sum + (probability(logit * inverse) - sample.label) * logit, 0);
    if (slope > 0) high = inverse;
    else low = inverse;
  }
  return Math.round(200 / (low + high)) / 100;
}
