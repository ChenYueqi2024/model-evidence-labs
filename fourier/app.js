import {transform, combine, shiftRight, magnitudeChanges, phaseCorrelation} from './fft.js';
import {find} from '../ui.js';

const size = 128;
const fields = ['file-a','file-b','distance','defaults','registration-shift'];
const guesses = Array.from(document.querySelectorAll('[data-guess]'));
let sources, original, revision = {a:0,b:0}, version = 0, pending = false;
let registration;
const getContext = id => find(id).getContext('2d');
const spectrum = image => transform(image,size);

function pixelsFrom(image, x, y, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0,0,size,size);
  context.drawImage(image,x,y,width,height,0,0,size,size);
  const data = context.getImageData(0,0,size,size).data;
  return Float64Array.from({length:size*size},(_, i) =>
    .2126 * data[4*i] + .7152 * data[4*i+1] + .0722 * data[4*i+2]);
}

function render(id, values, low=0, high=255) {
  const context = getContext(id);
  const data = context.createImageData(size,size);
  for (let i = 0; i < values.length; i++) {
    const gray = 255 * (values[i] - low) / (high - low || 1);
    data.data[4*i] = data.data[4*i+1] = data.data[4*i+2] = gray;
    data.data[4*i+3] = 255;
  }
  context.putImageData(data,0,0);
}

function reveal(answer) {
  const ab = combine(sources.a.frequency,sources.b.frequency,size);
  const ba = combine(sources.b.frequency,sources.a.frequency,size);
  const low = Math.min(...ab,...ba), high = Math.max(...ab,...ba);
  render('ab',ab,low,high);
  render('ba',ba,low,high);
  find('swaps').hidden = false;
  const choice = {a:'更像 A',b:'更像 B',both:'要看图像'};
  const observation = sources.a === original.a && sources.b === original.b
    ? '这对样图的左列保留了叶脉和叶缘，右列保留了建筑的山墙和拱门。观察这些轮廓分别来自哪张图的相位。'
    : '观察两张结果里的轮廓与细节，判断哪些结构随相位保留。';
  find('swap-note').textContent = '你的猜测是「' + choice[answer] + '」。' + observation;
}

const centered = (x,y) => ((y+size/2)%size)*size + (x+size/2)%size;
function drawRegistration() {
  const canvas = find('registration-plot');
  const context = canvas.getContext('2d');
  const width = canvas.clientWidth, height = canvas.clientHeight, scale = devicePixelRatio || 1;
  if (!width || !height) return;
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  const x = offset => 23 + offset * (width - 47) / (size - 1);
  const bottom = height - 26;
  context.strokeStyle = '#aebac0';
  context.beginPath();
  context.moveTo(x(0),bottom); context.lineTo(x(size - 1),bottom);
  context.stroke();
  context.fillStyle = '#394755';
  context.font = '12px system-ui';
  context.textAlign = 'center';
  for (const offset of [0,32,64,96,127]) context.fillText(offset + ' px',x(offset),height - 6);
  if (!registration) return;
  const amplitude = Math.max(...registration.map(Math.abs));
  if (!amplitude) return;
  const y = value => 9 + (bottom - 14) * (.5 - .5 * value / amplitude);
  context.strokeStyle = '#d6dedf';
  context.beginPath(); context.moveTo(x(0),y(0)); context.lineTo(x(size-1),y(0)); context.stroke();
  context.beginPath();
  registration.forEach((value,i) => i ? context.lineTo(x(i),y(value)) : context.moveTo(x(i),y(value)));
  context.strokeStyle = '#953a2d';
  context.lineWidth = 2;
  context.stroke();
}

function recoverShift(reference, shifted) {
  const correlation = phaseCorrelation(reference, shifted, size);
  registration = correlation?.subarray(0,size);
  const status = find('registration-result');
  if (!registration) {
    status.textContent = '这幅图的非直流频谱没有可用信号，无法估计位移。';
  } else {
    const peak = Math.max(...registration);
    const candidates = Array.from(registration.keys()).filter(i => registration[i] >= .95 * peak);
    status.textContent = candidates.length === 1
      ? '从峰的位置估计循环右移 ' + candidates[0] + ' px。'
      : '发现 ' + candidates.length + ' 个位置接近最高峰。仅凭这一对图无法可靠区分它们。';
  }
  drawRegistration();
}

function shift() {
  const offset = Number(find('distance').value);
  const {pixels,frequency} = sources.a;
  const shifted = shiftRight(pixels,size,offset);
  const other = spectrum(shifted);
  const before = new Float64Array(size * size), after = before.slice(), phase = before.slice();
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const index = centered(x,y), destination = y * size + x;
    const magnitude = Math.hypot(frequency.re[index],frequency.im[index]);
    before[destination] = Math.log1p(magnitude);
    after[destination] = Math.log1p(Math.hypot(other.re[index],other.im[index]));
    if (magnitude > .001) {
      const delta = Math.atan2(other.im[index],other.re[index]) - Math.atan2(frequency.im[index],frequency.re[index]);
      phase[destination] = Math.atan2(Math.sin(delta),Math.cos(delta)) + Math.PI;
    }
  }
  const max = Math.max(...before);
  render('shifted',shifted);
  render('spectrum-a',before,0,max);
  render('spectrum-shifted',after,0,max);
  render('phase',phase,0,2*Math.PI);
  find('shift-value').textContent = offset + ' px';
  find('registration-shift').value = offset;
  find('registration-shift-value').textContent = offset + ' px';
  recoverShift(frequency,other);
  const changes = magnitudeChanges(frequency,other);
  find('magnitude-note').textContent = '非直流幅度最大差 ÷ 原图最大非直流幅度 = ' +
    changes.toExponential(2) + '。接近零的残差来自浮点计算。';
}

function refresh() {
  for (const key of ['a','b']) {
    render('image-'+key,sources[key].pixels);
    find('name-'+key).textContent = sources[key].name;
  }
  find('swaps').hidden = true;
  find('swap-note').textContent = '选一个猜测，揭晓两张重建图。';
  shift();
}

for (const button of guesses) button.onclick = () => reveal(button.dataset.guess);
find('distance').oninput = () => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; shift(); });
};
find('registration-shift').oninput = () => {
  find('distance').value = find('registration-shift').value;
  find('distance').oninput();
};
find('defaults').onclick = () => {
  version++;
  sources = {...original};
  for (const key of ['a','b']) find('file-'+key).value = '';
  refresh();
};

for (const key of ['a','b']) {
  const field = find('file-'+key);
  field.onchange = async () => {
    const file = field.files[0];
    if (!file) return;
    field.value = '';
    const current = ++revision[key], generation = version;
    if (!['image/png','image/jpeg','image/webp','image/avif'].includes(file.type) || file.size > 15*1024*1024) {
      find('swap-note').textContent = '请选择 15 MiB 以内的 JPEG、PNG、WebP 或 AVIF 文件。';
      return;
    }
    try {
      const image = await createImageBitmap(file);
      try {
        if (current !== revision[key] || generation !== version) return;
        const span = Math.min(image.width,image.height);
        const pixels = pixelsFrom(image,(image.width-span)/2,(image.height-span)/2,span,span);
        sources[key] = {pixels,frequency:spectrum(pixels),name:'图 '+key.toUpperCase()+' · 自选图'};
        refresh();
      } finally { image.close(); }
    } catch {
      if (current === revision[key] && generation === version) find('swap-note').textContent = '图片无法读取，现有图像仍可继续使用。';
    }
  };
}

try {
  const asset = new Image();
  asset.src = 'assets/subjects.png';
  await asset.decode();
  const half = asset.width / 2, span = Math.min(half,asset.height);
  original = {};
  for (const [i,key] of ['a','b'].entries()) {
    const pixels = pixelsFrom(asset,i*half+(half-span)/2,(asset.height-span)/2,span,span);
    original[key] = {pixels,frequency:spectrum(pixels),name:i ? '图 B · 枫叶' : '图 A · 校园建筑'};
  }
  find('defaults').onclick();
  new ResizeObserver(drawRegistration).observe(find('registration-plot'));
  for (const id of fields) find(id).disabled = false;
  for (const button of guesses) button.disabled = false;
} catch {
  find('swap-note').textContent = '样图没有载入，请刷新后重试。';
}
