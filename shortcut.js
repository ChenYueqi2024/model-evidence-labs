import {dataset, score, predictions, probability, shapes, colors} from './model.js';
import {find, pct, draw, thumbnail, trainInWorker} from './ui.js';

const examples = dataset('test', 50);
let index = 0, weights, reference, result, activeGroup = 1, trainedBias = 95;
const controls = ['same','flip','another','retrain','balance'];
const groupOf = sample => sample.label * 2 + sample.color;
const labels = Array.from({length:4}, (_, g) => colors[g % 2] + shapes[Math.floor(g / 2)]);
const accuracy = rows => rows.filter(row => row.correct).length / rows.length;

function pair(guess) {
  const original = {...examples[index], color:examples[index].label};
  const changed = {...original, color:1-original.color};
  draw(find('original'), original);
  draw(find('changed'), changed);
  find('answer').textContent = '';
  if (!weights) return;
  const logits = [score(weights, original), score(weights, changed)];
  const descriptions = logits.map(logit => {
    const p = probability(logit);
    return '圆 ' + pct(1-p, 1) + ' · 方 ' + pct(p, 1);
  });
  find('original-score').textContent = descriptions[0];
  find('changed-score').textContent = '等待你的预测';
  if (guess === undefined) return;
  find('changed-score').textContent = descriptions[1];
  const [a,b] = logits.map(logit => Number(logit >= 0));
  const delta = 100 * (probability(logits[1]) - probability(logits[0]));
  find('answer').textContent = (guess === (a !== b) ? '猜中了。' : '和你的预测不同。') +
    '模型从「' + shapes[a] + '」判为「' + shapes[b] + '」，方形概率变化 ' +
    (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1) + ' 个百分点。';
}

function showErrors() {
  const failures = result.filter(row => groupOf(row.sample) === activeGroup && !row.correct);
  const message = document.createElement('p');
  message.textContent = labels[activeGroup] + ' · 错判 ' + failures.length + ' 张' +
    (failures.length > 10 ? '，这里展示前 10 张。' : '。');
  find('errors').replaceChildren(message, ...failures.slice(0,10).map(row => thumbnail(row.sample)));
}

function report() {
  const groups = find('groups');
  groups.replaceChildren();
  const rates = [];
  for (const [g, label] of labels.entries()) {
    const row = groups.insertRow();
    const heading = document.createElement('th');
    heading.scope = 'row';
    const button = document.createElement('button');
    button.className = 'text-button';
    button.textContent = label;
    button.addEventListener('click', () => { activeGroup = g; showErrors(); });
    heading.append(button);
    row.append(heading);
    const count = (Math.floor(g / 2) === g % 2 ? trainedBias : 100 - trainedBias) * 2;
    const rate = accuracy(result.filter(r => groupOf(r.sample) === g));
    rates.push(rate);
    for (const value of [count, pct(accuracy(reference.filter(r => groupOf(r.sample) === g))), pct(rate)]) {
      row.insertCell().textContent = value;
    }
  }
  find('summary').textContent = '当前模型 · 均衡测试总准确率 ' + pct(accuracy(result), 1) +
    ' · 最差组 ' + pct(Math.min(...rates)) + '。常见搭配占 95% 时，同一模型的总准确率 ' +
    pct(accuracy(predictions(weights, 'test', 95)), 1) + '。';
  showErrors();
}

async function retrain() {
  const bias = Number(find('bias').value);
  for (const id of controls) find(id).disabled = true;
  find('bias').disabled = true;
  try {
    weights = await trainInWorker(bias, find('training-status'));
    trainedBias = bias;
    result = predictions(weights, 'test', 50);
    reference ??= result;
    find('training-status').textContent = '当前模型以 ' + bias + '% 常见搭配训练完成。';
    for (const id of ['continue','next']) find(id).href = 'calibration/?bias=' + bias;
    report();
    pair();
  } catch {
    find('training-status').textContent = '训练未完成。请点击「重新训练」再试。';
  } finally {
    for (const id of controls) find(id).disabled = !weights && !['retrain','balance'].includes(id);
    find('bias').disabled = false;
  }
}
find('same').onclick = () => pair(false);
find('flip').onclick = () => pair(true);
find('another').onclick = () => { index = (index + 203) % examples.length; pair(); };
find('bias').oninput = () => { find('ratio').textContent = find('bias').value + '%'; };
find('balance').onclick = () => { find('bias').value = 50; find('bias').oninput(); };
find('retrain').onclick = retrain;
pair();
retrain();
