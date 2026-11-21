import {predictions, shapes} from '../model.js';
import {find, pct, thumbnail, trainInWorker} from '../ui.js';
import {binsFor, fitTemperature, nll} from './metrics.js';

const input = new URLSearchParams(location.search).get('bias');
const bias = /^\d+$/.test(input ?? '') && Number(input) >= 50 && Number(input) <= 100 ? Number(input) : 95;
let weights, test, validation, bins = [], selected = 8, checked = false;
const temperature = () => Number(find('temperature').value);
const range = bin => pct(bin.min) + '–' + pct(bin.max);

function plot() {
  if (!checked) return;
  const canvas = find('reliability'), context = canvas.getContext('2d');
  const width = canvas.clientWidth, height = canvas.clientHeight, scale = devicePixelRatio || 1;
  if (width < 60) return;
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  const x = value => 44 + (width - 64) * value;
  const y = value => height - 35 - (height - 51) * value;
  context.font = '12px system-ui';
  for (const tick of [0,.25,.5,.75,1]) {
    context.beginPath();
    context.strokeStyle = '#dadee6';
    context.moveTo(x(0),y(tick));
    context.lineTo(x(1),y(tick));
    context.stroke();
    context.fillStyle = '#354455';
    context.fillText(pct(tick), 5, y(tick)+4);
    context.fillText(pct(tick), x(tick)-11, y(0)+21);
  }
  context.beginPath();
  context.strokeStyle = '#647287';
  context.setLineDash([4,4]);
  context.moveTo(x(0),y(0));
  context.lineTo(x(1),y(1));
  context.stroke();
  context.setLineDash([]);
  for (const [i, bin] of bins.entries()) {
    if (!bin.count) continue;
    const cx = x(bin.confidence), cy = y(bin.accuracy);
    context.beginPath();
    context.fillStyle = i === selected ? '#ad4933' : '#254aba';
    context.arc(cx, cy, 3 + Math.sqrt(bin.count) / 3, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'white';
    context.stroke();
  }
}

function report() {
  const total = test.length;
  const acc = bins.reduce((sum,b) => sum + b.correct, 0) / total;
  const ece = bins.reduce((sum,b) => sum + b.count * Math.abs(b.confidence-b.accuracy),0) / total;
  find('metrics').textContent = '总体准确率 ' + pct(acc,1) + ' · ECE ' + pct(ece,1) +
    ' · 测试集负对数似然 ' + nll(test,1).toFixed(3) + '（T = 1） / ' +
    nll(test,temperature()).toFixed(3) + '（当前温度）';
  const rows = find('bin-rows');
  rows.replaceChildren();
  for (const bin of bins) {
    const row = rows.insertRow();
    for (const value of [range(bin),bin.count,bin.count ? pct(bin.confidence,1) : '—',
      bin.count ? bin.correct + ' / ' + bin.count + ' · ' + pct(bin.accuracy,1) : '—']) row.insertCell().textContent = value;
  }
  plot();
}

function basket(rebuild) {
  if (rebuild) {
    bins = binsFor(test, temperature());
    const select = find('bucket');
    select.replaceChildren(...bins.map((bin,i) => {
      const option = new Option(range(bin) + ' · ' + bin.count + ' 张', i);
      option.disabled = !bin.count;
      return option;
    }));
    if (!bins[selected].count) selected = bins.reduce((nearest, bin, i) =>
      bin.count && Math.abs(i-8) < Math.abs(nearest-8) ? i : nearest, 30);
    select.value = selected;
  }
  const bin = bins[selected];
  find('basket-info').textContent = '这档共有 ' + bin.count + ' 张，平均把握为 ' + pct(bin.confidence,1) +
    '。' + (bin.count > 10 ? '下面展示前 10 张。' : '');
  find('basket').replaceChildren(...bin.rows.slice(0,10).map(row => thumbnail(row.sample)));
  const guess = find('guess-value');
  guess.max = bin.count;
  guess.value = Math.round(bin.count * bin.confidence);
  find('outcome').textContent = '';
  if (checked) report();
}

find('guess').onsubmit = event => {
  event.preventDefault();
  const bin = bins[selected];
  const guess = Number(find('guess-value').value);
  find('outcome').textContent = '你猜 ' + guess + ' 张，实际答对 ' + bin.correct + ' / ' + bin.count +
    ' 张（' + pct(bin.accuracy,1) + '）。';
  const thumbnails = bin.rows.slice(0,10).map(row => {
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    caption.textContent = (row.correct ? '答对' : '答错') + ' · 判为' + shapes[Number(row.logit>=0)];
    figure.append(thumbnail(row.sample),caption);
    return figure;
  });
  find('basket').replaceChildren(...thumbnails);
  checked = true;
  find('results').hidden = false;
  report();
};

function adjustTemperature() {
  find('temp-value').textContent = temperature().toFixed(2);
  basket(true);
}
find('temperature').oninput = adjustTemperature;
find('reset').onclick = () => { find('temperature').value = 1; adjustTemperature(); };
find('fit').onclick = () => {
  const fitted = fitTemperature(validation);
  find('temperature').value = fitted;
  adjustTemperature();
  find('fit-note').textContent = '400 张独立验证图拟合出 T = ' + fitted.toFixed(2) +
    '。验证集负对数似然 ' + nll(validation,1).toFixed(3) + ' → ' + nll(validation,fitted).toFixed(3) +
    '。换测试分布后继续使用同一温度，观察校准效果。';
};
find('bucket').onchange = () => { selected = Number(find('bucket').value); basket(false); };
find('distribution').onchange = () => {
  test = predictions(weights,'test', Number(find('distribution').value));
  basket(true);
};

try {
  weights = await trainInWorker(bias, find('model-status'));
  find('model-status').textContent = '固定模型 · 训练搭配 ' + bias + '%';
  validation = predictions(weights, 'validation', 90);
  find('distribution').onchange();
  for (const name of ['distribution','temperature','fit','reset','bucket','guess-value','reveal']) find(name).disabled = false;
  new ResizeObserver(plot).observe(find('reliability'));
} catch {
  find('model-status').textContent = '模型载入失败，请刷新重试。';
}
