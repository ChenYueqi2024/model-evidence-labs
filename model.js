export const SIDE = 12;
export const STEPS = 240;
export const shapes = ['圆形', '方形'];
export const colors = ['蓝底', '红底'];
const filters = 10, features = filters * 4, head = filters * 19, batch = 20;
export const splits = {train:431, validation:551, test:769};

function rng(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function dataset(split, percent) {
  const random = rng(splits[split]), records = [];
  for (let label = 0; label < 2; label++) {
    const order = Array.from({length:200}, (_, i) => i);
    for (let i = 199; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let i = 0; i < 200; i++) {
      records.push({id:split + '-' + label + '-' + i, label,
        color: order[i] < percent * 2 ? label : 1 - label,
        x: 5.5 + 2.2 * (random() - .5), y: 5.5 + 2.2 * (random() - .5),
        radius: 3.75 + .85 * (random() - .5), ink: .67 + .3 * random(),
        tint: .1 * (random() - .5)});
    }
  }
  return records;
}

export function pixels(sample) {
  const values = new Float32Array(SIDE * SIDE * 2);
  for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) {
    const dx = Math.abs(x - sample.x), dy = Math.abs(y - sample.y);
    const distance = sample.label ? Math.max(dx, dy) : Math.hypot(dx, dy);
    const alpha = Math.max(0, Math.min(1, sample.radius + .5 - distance));
    const index = 2 * (y * SIDE + x);
    values[index] = alpha * sample.ink;
    values[index + 1] = (1 - alpha) * ((sample.color ? .65 : -.65) + sample.tint);
  }
  return values;
}

// Every filter shares its 3×3×2 weights across all locations. Four regional averages
// retain some spatial layout before the binary linear head.
const patches = Array.from({length:25}, (_, slot) => {
  const x = slot % 5 * 2, y = Math.floor(slot / 5) * 2;
  const region = (y < 5 ? 0 : 2) + (x < 5 ? 0 : 1);
  return {pixel:(y * SIDE + x) * 2, feature:region * filters, scale:[9, 6, 6, 4][region]};
});
function forward(weights, input, activations, pooled) {
  pooled.fill(0);
  for (let slot = 0; slot < patches.length; slot++) {
    const {pixel, feature, scale} = patches[slot];
    for (let f = 0; f < filters; f++) {
      const offset = f * 19;
      let sum = weights[offset + 18];
      for (let row = 0; row < 3; row++) for (let c = 0; c < 6; c++) {
        sum += input[pixel + row * SIDE * 2 + c] * weights[offset + row * 6 + c];
      }
      activations[slot * filters + f] = sum;
      pooled[feature + f] += (sum >= 0 ? sum : .1 * sum) / scale;
    }
  }
  let logit = weights[head + features];
  for (let i = 0; i < features; i++) logit += pooled[i] * weights[head + i];
  return logit;
}

export const probability = (logit, temperature = 1) => 1 / (1 + Math.exp(-logit / temperature));
export function score(weights, sample) {
  return forward(weights, pixels(sample), new Float64Array(25 * filters), new Float64Array(features));
}

export function train(percent, progress = () => {}) {
  const samples = dataset('train', percent).map(sample => ({label:sample.label, input:pixels(sample)}));
  const initialize = rng(920), random = rng(2004);
  const weights = Float64Array.from({length:head + features + 1}, () => (initialize() - .5) * .44);
  const activations = new Float64Array(25 * filters), pooled = new Float64Array(features);
  const grad = new Float64Array(weights.length), first = grad.slice(), second = grad.slice();
  for (let step = 1; step <= STEPS; step++) {
    grad.fill(0);
    for (let b = 0; b < batch; b++) {
      const {label, input} = samples[Math.floor(random() * samples.length)];
      const delta = (probability(forward(weights, input, activations, pooled)) - label) / batch;
      for (let i = 0; i < features; i++) grad[head + i] += delta * pooled[i];
      grad[head + features] += delta;
      for (let slot = 0; slot < patches.length; slot++) {
        const {pixel, feature, scale} = patches[slot];
        for (let f = 0; f < filters; f++) {
          const offset = f * 19, z = activations[slot * filters + f];
          const g = delta * weights[head + feature + f] * (z >= 0 ? 1 : .1) / scale;
          grad[offset + 18] += g;
          for (let row = 0; row < 3; row++) for (let c = 0; c < 6; c++) {
            grad[offset + row * 6 + c] += g * input[pixel + row * SIDE * 2 + c];
          }
        }
      }
    }
    const bias1 = 1 - .9 ** step, bias2 = 1 - .999 ** step;
    for (let i = 0; i < weights.length; i++) {
      first[i] = .9 * first[i] + .1 * grad[i];
      second[i] = .999 * second[i] + .001 * grad[i] ** 2;
      weights[i] -= .023 * first[i] / bias1 / (Math.sqrt(second[i] / bias2) + 1e-8);
    }
    if (step % 24 === 0) progress(step);
  }
  return weights;
}

export function predictions(weights, split, percent) {
  return dataset(split, percent).map(sample => {
    const logit = score(weights, sample);
    return {sample, logit, correct:Number(logit >= 0) === sample.label};
  });
}
