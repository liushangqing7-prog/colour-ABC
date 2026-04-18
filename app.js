const state = {
  sourceImage: null,
  targetImage: null,
  originalImageData: null,
  workingImageData: null,
  currentPalette: [],
  sliders: {
    hue: 0,
    saturation: 1,
    value: 1,
    hslLightness: 1,
    labL: 0,
    laba: 0,
    labb: 0,
    linearGain: 1,
    nonlinearGamma: 1,
  },
};

const els = {
  imageInput: document.getElementById('imageInput'),
  targetInput: document.getElementById('targetInput'),
  dropZone: document.getElementById('dropZone'),
  previewCanvas: document.getElementById('previewCanvas'),
  histCanvas: document.getElementById('histCanvas'),
  paletteGrid: document.getElementById('paletteGrid'),
  pcaOutput: document.getElementById('pcaOutput'),
  statusText: document.getElementById('statusText'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  themeBtn: document.getElementById('themeBtn'),
  kInput: document.getElementById('kInput'),
  kValueLabel: document.getElementById('kValueLabel'),
  colorSpace: document.getElementById('colorSpace'),
  adjustmentControls: document.getElementById('adjustmentControls'),
};

const previewCtx = els.previewCanvas.getContext('2d');
const histCtx = els.histCanvas.getContext('2d');

function setLoading(flag, message = '处理中...') {
  els.loadingIndicator.classList.toggle('hidden', !flag);
  els.statusText.textContent = flag ? message : '就绪';
}

function clamp(v, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [clamp((r + m) * 255), clamp((g + m) * 255), clamp((b + m) * 255)];
}

function rgbToLab(r, g, b) {
  let [x, y, z] = rgbToXyz(r, g, b);
  x /= 95.047; y /= 100.0; z /= 108.883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToRgb(L, a, b) {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const inv = (t) => {
    const t3 = t ** 3;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  x = 95.047 * inv(x);
  y = 100.0 * inv(y);
  z = 108.883 * inv(z);
  return xyzToRgb(x, y, z);
}

function rgbToXyz(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const gamma = (u) => (u > 0.04045 ? ((u + 0.055) / 1.055) ** 2.4 : u / 12.92);
  r = gamma(r); g = gamma(g); b = gamma(b);
  return [
    (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100,
    (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100,
    (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100,
  ];
}

function xyzToRgb(x, y, z) {
  x /= 100; y /= 100; z /= 100;
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b = x * 0.0557 + y * -0.204 + z * 1.057;
  const invGamma = (u) => (u > 0.0031308 ? 1.055 * (u ** (1 / 2.4)) - 0.055 : 12.92 * u);
  r = clamp(invGamma(r) * 255);
  g = clamp(invGamma(g) * 255);
  b = clamp(invGamma(b) * 255);
  return [r, g, b];
}

function initSliders() {
  const configs = [
    ['hue', 'Hue 旋转', -180, 180, 1, 0],
    ['saturation', 'HSV 饱和度', 0, 2, 0.01, 1],
    ['value', 'HSV 明度', 0, 2, 0.01, 1],
    ['hslLightness', 'HSL 明度', 0, 2, 0.01, 1],
    ['labL', 'Lab-L', -40, 40, 1, 0],
    ['laba', 'Lab-a', -40, 40, 1, 0],
    ['labb', 'Lab-b', -40, 40, 1, 0],
    ['linearGain', '线性增益', 0.5, 1.5, 0.01, 1],
    ['nonlinearGamma', '非线性 Gamma', 0.5, 2.5, 0.01, 1],
  ];
  els.adjustmentControls.innerHTML = '';
  configs.forEach(([key, label, min, max, step, val]) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="flex justify-between text-xs"><span>${label}</span><span id="label-${key}" class="slider-value">${val}</span></div>
      <input id="slider-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" class="w-full" />
    `;
    els.adjustmentControls.appendChild(wrap);
    document.getElementById(`slider-${key}`).addEventListener('input', (e) => {
      state.sliders[key] = Number(e.target.value);
      document.getElementById(`label-${key}`).textContent = Number(e.target.value).toFixed(2);
      previewAdjusted();
    });
  });
}

function drawImageOnCanvas(img) {
  const maxW = 900, maxH = 620;
  let { width, height } = img;
  const ratio = Math.min(maxW / width, maxH / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);
  els.previewCanvas.width = width;
  els.previewCanvas.height = height;
  previewCtx.drawImage(img, 0, 0, width, height);
  state.originalImageData = previewCtx.getImageData(0, 0, width, height);
  state.workingImageData = new ImageData(new Uint8ClampedArray(state.originalImageData.data), width, height);
}

function getSamplePixels(step = 4) {
  if (!state.workingImageData) return [];
  const { data, width, height } = state.workingImageData;
  const pixels = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  return pixels;
}

function runKMeans(pixels, k = 5, space = 'rgb', iterations = 16) {
  if (!pixels.length) return [];
  let features = pixels.map((p) => (space === 'lab' ? rgbToLab(...p) : p.map(Number)));
  let centroids = [...features].sort(() => Math.random() - 0.5).slice(0, k).map((c) => [...c]);
  let labels = new Array(features.length).fill(0);

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < features.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (features[i][0] - centroids[c][0]) ** 2 + (features[i][1] - centroids[c][1]) ** 2 + (features[i][2] - centroids[c][2]) ** 2;
        if (d < bestDist) { bestDist = d; best = c; }
      }
      labels[i] = best;
    }

    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < features.length; i++) {
      const l = labels[i];
      sums[l][0] += features[i][0];
      sums[l][1] += features[i][1];
      sums[l][2] += features[i][2];
      sums[l][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }

  const counts = new Array(k).fill(0);
  labels.forEach((l) => counts[l]++);
  const result = centroids.map((center, i) => {
    const rgb = space === 'lab' ? labToRgb(center[0], center[1], center[2]) : center;
    return {
      rgb: rgb.map((v) => Math.round(v)),
      ratio: counts[i] / pixels.length,
      center: center.map((v) => Number(v.toFixed(2))),
    };
  }).sort((a, b) => b.ratio - a.ratio);
  return result;
}

function runMeanShift(pixels, bandwidth = 28, maxIter = 8) {
  const features = pixels.map((p) => p.map(Number));
  const shifted = features.map((p) => [...p]);
  for (let i = 0; i < shifted.length; i++) {
    let point = [...shifted[i]];
    for (let it = 0; it < maxIter; it++) {
      let sum = [0, 0, 0], count = 0;
      for (const q of features) {
        const d = Math.hypot(point[0] - q[0], point[1] - q[1], point[2] - q[2]);
        if (d < bandwidth) {
          sum[0] += q[0]; sum[1] += q[1]; sum[2] += q[2]; count++;
        }
      }
      if (!count) break;
      const next = [sum[0] / count, sum[1] / count, sum[2] / count];
      if (Math.hypot(point[0] - next[0], point[1] - next[1], point[2] - next[2]) < 1) break;
      point = next;
    }
    shifted[i] = point;
  }

  const clusters = [];
  const mergeDist = 18;
  shifted.forEach((p) => {
    const found = clusters.find((c) => Math.hypot(c.center[0] - p[0], c.center[1] - p[1], c.center[2] - p[2]) < mergeDist);
    if (found) {
      found.sum[0] += p[0]; found.sum[1] += p[1]; found.sum[2] += p[2]; found.count++;
      found.center = [found.sum[0] / found.count, found.sum[1] / found.count, found.sum[2] / found.count];
    } else {
      clusters.push({ center: [...p], sum: [...p], count: 1 });
    }
  });

  return clusters
    .map((c) => ({ rgb: c.center.map((v) => Math.round(v)), ratio: c.count / shifted.length }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);
}

function drawPalette(items, title = '') {
  els.paletteGrid.innerHTML = '';
  items.forEach((it, idx) => {
    const hex = '#' + it.rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    const box = document.createElement('div');
    box.className = 'p-2 rounded border border-slate-200 dark:border-slate-700';
    box.innerHTML = `
      <div class="swatch" style="background:${hex}"></div>
      <p class="text-xs mt-1">${hex.toUpperCase()}</p>
      <p class="text-xs text-slate-500">RGB(${it.rgb.join(', ')})</p>
      <p class="text-xs text-slate-500">占比 ${(it.ratio * 100).toFixed(2)}%</p>
      ${it.center ? `<p class="text-[11px] text-slate-400">中心: ${it.center.join(', ')}</p>` : ''}
    `;
    if (idx === 0 && title) {
      const badge = document.createElement('div');
      badge.className = 'text-[10px] mb-1 text-brand-600';
      badge.textContent = title;
      box.prepend(badge);
    }
    els.paletteGrid.appendChild(box);
  });
  state.currentPalette = items;
}

function runHistogram() {
  if (!state.workingImageData) return;
  const binsR = new Array(256).fill(0);
  const binsG = new Array(256).fill(0);
  const binsB = new Array(256).fill(0);
  const data = state.workingImageData.data;
  for (let i = 0; i < data.length; i += 4) {
    binsR[data[i]]++;
    binsG[data[i + 1]]++;
    binsB[data[i + 2]]++;
  }
  const max = Math.max(...binsR, ...binsG, ...binsB);
  histCtx.clearRect(0, 0, els.histCanvas.width, els.histCanvas.height);
  histCtx.fillStyle = '#0f172a';
  histCtx.fillRect(0, 0, els.histCanvas.width, els.histCanvas.height);
  const draw = (arr, color) => {
    histCtx.strokeStyle = color;
    histCtx.beginPath();
    arr.forEach((v, i) => {
      const x = (i / 255) * els.histCanvas.width;
      const y = els.histCanvas.height - (v / max) * (els.histCanvas.height - 10);
      if (i === 0) histCtx.moveTo(x, y); else histCtx.lineTo(x, y);
    });
    histCtx.stroke();
  };
  draw(binsR, '#ef4444');
  draw(binsG, '#22c55e');
  draw(binsB, '#3b82f6');

  const topColors = [binsR, binsG, binsB].map((b, idx) => ({
    channel: ['R', 'G', 'B'][idx],
    value: b.indexOf(Math.max(...b)),
  }));
  els.statusText.textContent = `直方图完成 | 高频通道值: ${topColors.map((t) => `${t.channel}:${t.value}`).join(' ')}`;
}

function runPca() {
  const pixels = getSamplePixels(6).map((p) => p.map(Number));
  if (pixels.length < 3) return;
  const mean = [0, 0, 0];
  pixels.forEach((p) => { mean[0] += p[0]; mean[1] += p[1]; mean[2] += p[2]; });
  mean[0] /= pixels.length; mean[1] /= pixels.length; mean[2] /= pixels.length;
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  pixels.forEach((p) => {
    const d = [p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j];
  });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] /= (pixels.length - 1);

  const powerIter = (A, init = [1, 0.5, 0.2], n = 24) => {
    let v = [...init];
    for (let i = 0; i < n; i++) {
      const Av = [
        A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
        A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
        A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2],
      ];
      const norm = Math.hypot(...Av) || 1;
      v = Av.map((x) => x / norm);
    }
    const Av = [
      A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
      A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
      A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2],
    ];
    const lambda = v[0] * Av[0] + v[1] * Av[1] + v[2] * Av[2];
    return { v, lambda };
  };

  const pc1 = powerIter(cov);
  const deflated = cov.map((row, i) => row.map((val, j) => val - pc1.lambda * pc1.v[i] * pc1.v[j]));
  const pc2 = powerIter(deflated, [0.2, 1, 0.3]);
  const totalVar = cov[0][0] + cov[1][1] + cov[2][2];
  const explained = [pc1.lambda / totalVar, pc2.lambda / totalVar];

  els.pcaOutput.textContent = [
    `均值颜色向量: [${mean.map((n) => n.toFixed(2)).join(', ')}]`,
    `PC1 向量: [${pc1.v.map((n) => n.toFixed(4)).join(', ')}], 方差占比 ${(explained[0] * 100).toFixed(2)}%`,
    `PC2 向量: [${pc2.v.map((n) => n.toFixed(4)).join(', ')}], 方差占比 ${(explained[1] * 100).toFixed(2)}%`,
    `核心颜色分量（近似）: [${[0, 1, 2].map((i) => (mean[i] + pc1.v[i] * 40).toFixed(1)).join(', ')}]`,
  ].join('\n');
}

function previewAdjusted() {
  if (!state.originalImageData) return;
  const src = state.originalImageData.data;
  const out = new Uint8ClampedArray(src.length);
  const s = state.sliders;
  for (let i = 0; i < src.length; i += 4) {
    let r = src[i], g = src[i + 1], b = src[i + 2];
    let [h, sv, vv] = rgbToHsv(r, g, b);
    h = (h + s.hue + 360) % 360;
    sv = Math.min(1, sv * s.saturation);
    vv = Math.min(1, vv * s.value);
    [r, g, b] = hsvToRgb(h, sv, vv);

    let [L, a, bb] = rgbToLab(r, g, b);
    L = clamp(L + s.labL, 0, 100);
    a += s.laba;
    bb += s.labb;
    [r, g, b] = labToRgb(L, a, bb);

    r = clamp((r * s.linearGain / 255) ** (1 / s.nonlinearGamma) * 255);
    g = clamp((g * s.linearGain / 255) ** (1 / s.nonlinearGamma) * 255);
    b = clamp((b * s.linearGain / 255) ** (1 / s.nonlinearGamma) * 255);

    const lum = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    const hslLift = (s.hslLightness - 1) * 45;
    r = clamp(r + hslLift * lum);
    g = clamp(g + hslLift * lum);
    b = clamp(b + hslLift * lum);

    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = src[i + 3];
  }
  state.workingImageData = new ImageData(out, state.originalImageData.width, state.originalImageData.height);
  previewCtx.putImageData(state.workingImageData, 0, 0);
}

function areaFilterByClusters(k = 6, minRatio = 0.06) {
  const pixels = getSamplePixels(2);
  const clusters = runKMeans(pixels, k, 'lab', 10);
  const kept = clusters.filter((c) => c.ratio >= minRatio);
  drawPalette(kept, '面积筛选');
  const keptColors = kept.map((k) => k.rgb);
  if (!keptColors.length) return;

  const data = state.workingImageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let best = keptColors[0], bestD = Infinity;
    for (const c of keptColors) {
      const d = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    data[i] = best[0]; data[i + 1] = best[1]; data[i + 2] = best[2];
  }
  previewCtx.putImageData(state.workingImageData, 0, 0);
}

function statsLab(imageData) {
  const d = imageData.data;
  const m = [0, 0, 0];
  const s = [0, 0, 0];
  const vals = [];
  for (let i = 0; i < d.length; i += 4) {
    const lab = rgbToLab(d[i], d[i + 1], d[i + 2]);
    vals.push(lab);
    m[0] += lab[0]; m[1] += lab[1]; m[2] += lab[2];
  }
  m[0] /= vals.length; m[1] /= vals.length; m[2] /= vals.length;
  vals.forEach((v) => {
    s[0] += (v[0] - m[0]) ** 2;
    s[1] += (v[1] - m[1]) ** 2;
    s[2] += (v[2] - m[2]) ** 2;
  });
  s[0] = Math.sqrt(s[0] / vals.length);
  s[1] = Math.sqrt(s[1] / vals.length);
  s[2] = Math.sqrt(s[2] / vals.length);
  return { mean: m, std: s };
}

function applyReinhardTransfer() {
  if (!state.targetImage || !state.workingImageData) {
    alert('请先上传目标风格图。');
    return;
  }
  const temp = document.createElement('canvas');
  temp.width = state.workingImageData.width;
  temp.height = state.workingImageData.height;
  const tctx = temp.getContext('2d');
  tctx.drawImage(state.targetImage, 0, 0, temp.width, temp.height);
  const targetData = tctx.getImageData(0, 0, temp.width, temp.height);

  const srcStats = statsLab(state.workingImageData);
  const tarStats = statsLab(targetData);

  const src = state.workingImageData.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    let [L, a, b] = rgbToLab(src[i], src[i + 1], src[i + 2]);
    L = ((L - srcStats.mean[0]) * (tarStats.std[0] / (srcStats.std[0] + 1e-5))) + tarStats.mean[0];
    a = ((a - srcStats.mean[1]) * (tarStats.std[1] / (srcStats.std[1] + 1e-5))) + tarStats.mean[1];
    b = ((b - srcStats.mean[2]) * (tarStats.std[2] / (srcStats.std[2] + 1e-5))) + tarStats.mean[2];
    const rgb = labToRgb(L, a, b);
    out[i] = rgb[0]; out[i + 1] = rgb[1]; out[i + 2] = rgb[2]; out[i + 3] = src[i + 3];
  }
  state.workingImageData = new ImageData(out, state.workingImageData.width, state.workingImageData.height);
  previewCtx.putImageData(state.workingImageData, 0, 0);
}

function applyCurveTransform() {
  if (!state.workingImageData) return;
  const src = state.workingImageData.data;
  const out = new Uint8ClampedArray(src.length);
  const gain = state.sliders.linearGain;
  const gamma = state.sliders.nonlinearGamma;
  const curve = Array.from({ length: 256 }, (_, i) => {
    const x = i / 255;
    const linear = clamp(x * gain, 0, 1);
    const nonlinear = clamp(linear ** (1 / gamma), 0, 1);
    const film = 1 / (1 + Math.exp(-8 * (nonlinear - 0.5)));
    return clamp(film * 255);
  });
  for (let i = 0; i < src.length; i += 4) {
    out[i] = curve[src[i]];
    out[i + 1] = curve[src[i + 1]];
    out[i + 2] = curve[src[i + 2]];
    out[i + 3] = src[i + 3];
  }
  state.workingImageData = new ImageData(out, state.workingImageData.width, state.workingImageData.height);
  previewCtx.putImageData(state.workingImageData, 0, 0);
}

async function applyTfStyleTransferLite() {
  if (!window.tf) {
    alert('TensorFlow.js 未加载完成，请稍后重试。');
    return;
  }
  if (!state.targetImage || !state.workingImageData) {
    alert('请先上传目标风格图。');
    return;
  }
  const temp = document.createElement('canvas');
  temp.width = state.workingImageData.width;
  temp.height = state.workingImageData.height;
  const tctx = temp.getContext('2d');
  tctx.drawImage(state.targetImage, 0, 0, temp.width, temp.height);
  const targetData = tctx.getImageData(0, 0, temp.width, temp.height);

  const output = await tf.tidy(async () => {
    const src = tf.tensor(state.workingImageData.data, [state.workingImageData.height, state.workingImageData.width, 4], 'float32').slice([0,0,0],[state.workingImageData.height,state.workingImageData.width,3]);
    const tar = tf.tensor(targetData.data, [targetData.height, targetData.width, 4], 'float32').slice([0,0,0],[targetData.height,targetData.width,3]);
    const srcMean = src.mean([0,1]);
    const tarMean = tar.mean([0,1]);
    const srcStd = tf.sqrt(src.sub(srcMean).square().mean([0,1]).add(1e-5));
    const tarStd = tf.sqrt(tar.sub(tarMean).square().mean([0,1]).add(1e-5));
    const normalized = src.sub(srcMean).div(srcStd);
    const stylized = normalized.mul(tarStd).add(tarMean);
    const blend = stylized.mul(0.75).add(src.mul(0.25)).clipByValue(0,255);
    return await blend.data();
  });

  const out = new Uint8ClampedArray(state.workingImageData.data.length);
  for (let i = 0, j = 0; i < out.length; i += 4, j += 3) {
    out[i] = output[j]; out[i + 1] = output[j + 1]; out[i + 2] = output[j + 2]; out[i + 3] = 255;
  }
  state.workingImageData = new ImageData(out, state.workingImageData.width, state.workingImageData.height);
  previewCtx.putImageData(state.workingImageData, 0, 0);
}

function setupEvents() {
  els.kInput.addEventListener('input', (e) => {
    els.kValueLabel.textContent = e.target.value;
  });

  els.imageInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadImageFromFile(e.target.files[0], 'source');
  });
  els.targetInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadImageFromFile(e.target.files[0], 'target');
  });

  ['dragenter', 'dragover'].forEach((event) => {
    els.dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      els.dropZone.classList.add('border-brand-600');
    });
  });
  ['dragleave', 'drop'].forEach((event) => {
    els.dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove('border-brand-600');
    });
  });
  els.dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) loadImageFromFile(file, 'source');
  });

  document.getElementById('runKMeansBtn').addEventListener('click', () => {
    if (!state.workingImageData) return;
    setLoading(true, 'K-Means 提取中...');
    setTimeout(() => {
      const items = runKMeans(getSamplePixels(3), Number(els.kInput.value), els.colorSpace.value);
      drawPalette(items, `K-Means(${els.colorSpace.value.toUpperCase()})`);
      setLoading(false);
    }, 30);
  });

  document.getElementById('runMeanShiftBtn').addEventListener('click', () => {
    if (!state.workingImageData) return;
    setLoading(true, 'Mean Shift 提取中...');
    setTimeout(() => {
      drawPalette(runMeanShift(getSamplePixels(4)), 'Mean Shift');
      setLoading(false);
    }, 30);
  });

  document.getElementById('runHistBtn').addEventListener('click', runHistogram);
  document.getElementById('runPcaBtn').addEventListener('click', runPca);
  document.getElementById('runAreaFilterBtn').addEventListener('click', () => areaFilterByClusters(Number(els.kInput.value), 0.05));

  document.getElementById('applyAdjustBtn').addEventListener('click', previewAdjusted);
  document.getElementById('resetAdjustBtn').addEventListener('click', () => {
    initSliders();
    previewAdjusted();
  });

  document.getElementById('runReinhardBtn').addEventListener('click', applyReinhardTransfer);
  document.getElementById('runCurveBtn').addEventListener('click', applyCurveTransform);
  document.getElementById('runDlTransferBtn').addEventListener('click', async () => {
    setLoading(true, 'DL 简易迁移中...');
    try {
      await applyTfStyleTransferLite();
    } finally {
      setLoading(false);
    }
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!state.workingImageData) return;
    const a = document.createElement('a');
    a.download = `colour-aaa-${Date.now()}.png`;
    a.href = els.previewCanvas.toDataURL('image/png');
    a.click();
  });

  document.getElementById('copyPaletteBtn').addEventListener('click', async () => {
    if (!state.currentPalette.length) return;
    const text = state.currentPalette.map((c) => `rgb(${c.rgb.join(',')}) ${(c.ratio * 100).toFixed(2)}%`).join('\n');
    await navigator.clipboard.writeText(text);
    els.statusText.textContent = '色板已复制到剪贴板';
  });

  els.themeBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
  });
}

function loadImageFromFile(file, role = 'source') {
  const img = new Image();
  img.onload = () => {
    if (role === 'source') {
      state.sourceImage = img;
      drawImageOnCanvas(img);
      previewAdjusted();
      els.statusText.textContent = '原图已载入，可开始颜色分析。';
    } else {
      state.targetImage = img;
      els.statusText.textContent = '目标风格图已载入。';
    }
  };
  img.src = URL.createObjectURL(file);
}

initSliders();
setupEvents();
