function fft(real, imag, inverse) {
  const size = real.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let length = 2; length <= size; length *= 2) {
    const angle = (inverse ? 2 : -2) * Math.PI / length;
    const half = length / 2;
    for (let j = 0; j < half; j++) {
      const cos = Math.cos(angle * j), sin = Math.sin(angle * j);
      for (let start = j; start < size; start += length) {
        const end = start + half;
        const r = real[end] * cos - imag[end] * sin;
        const i = real[end] * sin + imag[end] * cos;
        real[end] = real[start] - r;
        imag[end] = imag[start] - i;
        real[start] += r;
        imag[start] += i;
      }
    }
  }
  if (inverse) for (let i = 0; i < size; i++) { real[i] /= size; imag[i] /= size; }
}

export function transform(real, size, imaginary = null, inverse = false) {
  const re = Float64Array.from(real), im = imaginary ? Float64Array.from(imaginary) : new Float64Array(re.length);
  for (let y = 0; y < size; y++) {
    fft(re.subarray(y * size, (y + 1) * size), im.subarray(y * size, (y + 1) * size), inverse);
  }
  const row = new Float64Array(size), col = new Float64Array(size);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) { row[y] = re[y * size + x]; col[y] = im[y * size + x]; }
    fft(row, col, inverse);
    for (let y = 0; y < size; y++) { re[y * size + x] = row[y]; im[y * size + x] = col[y]; }
  }
  return {re, im};
}

export function combine(magnitudeSource, phaseSource, size) {
  const real = new Float64Array(size * size), imaginary = real.slice();
  for (let i = 0; i < real.length; i++) {
    const amplitude = Math.hypot(magnitudeSource.re[i], magnitudeSource.im[i]);
    const phase = Math.atan2(phaseSource.im[i], phaseSource.re[i]);
    real[i] = amplitude * Math.cos(phase);
    imaginary[i] = amplitude * Math.sin(phase);
  }
  return transform(real, size, imaginary, true).re;
}

export function shiftRight(image, size, distance) {
  return image.map((_, i) => image[Math.floor(i / size) * size + (i % size - distance + size) % size]);
}

export function magnitudeChanges(a,b) {
  let largestError = 0, largestAC = 0;
  for (let i = 1; i < a.re.length; i++) {
    const original = Math.hypot(a.re[i], a.im[i]);
    largestAC = Math.max(largestAC, original);
    largestError = Math.max(largestError, Math.abs(original - Math.hypot(b.re[i],b.im[i])));
  }
  return largestError / (largestAC || 1);
}
