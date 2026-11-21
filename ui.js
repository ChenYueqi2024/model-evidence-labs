import {SIDE, pixels, shapes, colors, STEPS} from './model.js';
export const find = id => document.getElementById(id);
export const pct = (value, decimals = 0) => (value * 100).toFixed(decimals) + '%';

export function draw(canvas, sample) {
  const context = canvas.getContext('2d');
  const values = pixels(sample), image = context.createImageData(SIDE, SIDE);
  const background = sample.color ? [170, 56, 50] : [43, 76, 169];
  for (let i = 0; i < SIDE * SIDE; i++) {
    const coverage = values[i * 2] / sample.ink;
    const brightness = 170 + 77 * sample.ink;
    for (let c = 0; c < 3; c++) {
      image.data[4 * i + c] = Math.round((1 - coverage) * (background[c] + 130 * sample.tint) + coverage * brightness);
    }
    image.data[4 * i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  canvas.setAttribute('aria-label', colors[sample.color] + shapes[sample.label]);
}

export function thumbnail(sample) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIDE;
  canvas.setAttribute('role', 'img');
  draw(canvas, sample);
  return canvas;
}

export function trainInWorker(percent, status) {
  return new Promise((resolve, reject) => {
    status.textContent = '正在准备训练样本…';
    const worker = new Worker(new URL('./worker.js', import.meta.url), {type:'module'});
    const fail = () => {
      worker.terminate();
      reject(new Error('Training worker failed'));
    };
    worker.onerror = fail;
    worker.onmessage = ({data}) => {
      if (data.failed) { fail(); return; }
      if (data.step) status.textContent = '训练进度 ' + data.step + ' / ' + STEPS + ' 步';
      if (data.weights) {
        worker.terminate();
        resolve(data.weights);
      }
    };
    worker.postMessage(percent);
  });
}
