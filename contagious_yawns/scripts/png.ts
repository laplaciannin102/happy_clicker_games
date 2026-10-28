import { crc32, deflateSync, inflateSync } from 'node:zlib';

/** RGBA 8bit の画像（1画素 4バイト、左上から横に並ぶ） */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function readU32(b: Uint8Array, at: number): number {
  return ((b[at] ?? 0) * 0x1000000 + ((b[at + 1] ?? 0) << 16) + ((b[at + 2] ?? 0) << 8) + (b[at + 3] ?? 0)) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** 1画素のバイト数（8bit のみ） */
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * PNG を読む。ChatGPT などが出す、8bit・インターレースなしの PNG（グレー／RGB／パレット／透過つき）に対応する。
 * 対応していない形式はエラーにする（メッセージは画面に出す）。
 */
export function decodePng(file: Uint8Array): RgbaImage {
  if (!SIGNATURE.every((v, i) => file[i] === v)) throw new Error('PNG ではありません（JPEG や WebP なら PNG で保存し直してください）');
  let width = 0;
  let height = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  let alpha: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= file.length; ) {
    const len = readU32(file, at);
    const type = String.fromCharCode(...file.subarray(at + 4, at + 8));
    const body = file.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = readU32(body, 0);
      height = readU32(body, 4);
      const depth = body[8];
      colorType = body[9] ?? -1;
      if (depth !== 8) throw new Error(`色の深さ ${String(depth)}bit には対応していません（8bit のみ）`);
      if (body[12] !== 0) throw new Error('インターレース PNG には対応していません');
      if (CHANNELS[colorType] === undefined) throw new Error(`色の形式 ${colorType} には対応していません`);
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') alpha = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  const channels = CHANNELS[colorType];
  if (!channels || width === 0 || height === 0) throw new Error('PNG の中身が読めません');

  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  idat.reduce((off, c) => (joined.set(c, off), off + c.length), 0);
  const raw = inflateSync(joined);
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? (pixels[row + x - channels] ?? 0) : 0;
      const b = y > 0 ? (pixels[row - stride + x] ?? 0) : 0;
      const c = x >= channels && y > 0 ? (pixels[row - stride + x - channels] ?? 0) : 0;
      const v = raw[src + x] ?? 0;
      const pred = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : 0;
      pixels[row + x] = (v + pred) & 0xff;
    }
  }

  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const o = i * 4;
    const v0 = pixels[p] ?? 0;
    if (colorType === 3) {
      data[o] = palette?.[v0 * 3] ?? 0;
      data[o + 1] = palette?.[v0 * 3 + 1] ?? 0;
      data[o + 2] = palette?.[v0 * 3 + 2] ?? 0;
      data[o + 3] = alpha?.[v0] ?? 255;
    } else if (colorType === 0 || colorType === 4) {
      data[o] = data[o + 1] = data[o + 2] = v0;
      data[o + 3] = colorType === 4 ? (pixels[p + 1] ?? 255) : 255;
    } else {
      data[o] = v0;
      data[o + 1] = pixels[p + 1] ?? 0;
      data[o + 2] = pixels[p + 2] ?? 0;
      data[o + 3] = colorType === 6 ? (pixels[p + 3] ?? 255) : 255;
    }
  }
  return { width, height, data };
}

/** 透明（不透明度 255 未満）の画素が1つでもあるか。ChatGPT が背景を塗りつぶしていないかの確認に使う */
export function hasTransparency(img: RgbaImage): boolean {
  for (let i = 3; i < img.data.length; i += 4) if ((img.data[i] ?? 255) < 255) return true;
  return false;
}

/** 1方向の面積平均。dst[i] は src の [i·r, (i+1)·r) を重なった長さで平均する */
function weights(srcLen: number, dstLen: number): { from: number; w: number[] }[] {
  const r = srcLen / dstLen;
  return Array.from({ length: dstLen }, (_, i) => {
    const s0 = i * r;
    const s1 = s0 + r;
    const from = Math.floor(s0);
    const w: number[] = [];
    for (let j = from; j < Math.min(srcLen, Math.ceil(s1)); j++) w.push((Math.min(s1, j + 1) - Math.max(s0, j)) / r);
    return { from, w };
  });
}

/**
 * size×size の正方形に縮める。縦横比は保ち、余白は透明にして中央に置く。
 * content を指定すると、絵はその大きさまでにして周りに余白を残す（シートから切り出した絵用）。
 * 透明なふちが黒ずまないよう、色は不透明度を掛けた状態で平均する。
 */
export function resizeContain(img: RgbaImage, size: number, content = size): RgbaImage {
  const scale = Math.min(size, content) / Math.max(img.width, img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const pre = new Float64Array(img.width * img.height * 4);
  for (let i = 0; i < img.width * img.height; i++) {
    const a = (img.data[i * 4 + 3] ?? 0) / 255;
    for (let c = 0; c < 3; c++) pre[i * 4 + c] = (img.data[i * 4 + c] ?? 0) * a;
    pre[i * 4 + 3] = a;
  }
  // 横 → 縦の順に平均する
  const wx = weights(img.width, w);
  const mid = new Float64Array(w * img.height * 4);
  for (let y = 0; y < img.height; y++) {
    wx.forEach(({ from, w: ws }, x) => {
      ws.forEach((k, j) => {
        for (let c = 0; c < 4; c++) mid[(y * w + x) * 4 + c] = (mid[(y * w + x) * 4 + c] ?? 0) + (pre[(y * img.width + from + j) * 4 + c] ?? 0) * k;
      });
    });
  }
  const wy = weights(img.height, h);
  const out = new Uint8Array(size * size * 4);
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);
  wy.forEach(({ from, w: ws }, y) => {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      ws.forEach((k, j) => {
        for (let c = 0; c < 4; c++) acc[c] = (acc[c] ?? 0) + (mid[((from + j) * w + x) * 4 + c] ?? 0) * k;
      });
      const a = acc[3] ?? 0;
      const o = ((oy + y) * size + ox + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = a > 0 ? Math.round(Math.min(255, (acc[c] ?? 0) / a)) : 0;
      out[o + 3] = Math.round(Math.min(1, a) * 255);
    }
  });
  return { width: size, height: size, data: out };
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

/** RGBA 8bit の PNG に書き出す。行ごとに、いちばん小さくなりそうなフィルターを選ぶ。 */
export function encodePng(img: RgbaImage): Uint8Array {
  const stride = img.width * 4;
  const raw = new Uint8Array((stride + 1) * img.height);
  const candidate = new Uint8Array(stride);
  for (let y = 0; y < img.height; y++) {
    const row = y * stride;
    let best = 0;
    let bestScore = Infinity;
    let bestRow = new Uint8Array(stride);
    for (let f = 0; f <= 4; f++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const v = img.data[row + x] ?? 0;
        const a = x >= 4 ? (img.data[row + x - 4] ?? 0) : 0;
        const b = y > 0 ? (img.data[row - stride + x] ?? 0) : 0;
        const c = x >= 4 && y > 0 ? (img.data[row - stride + x - 4] ?? 0) : 0;
        const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0;
        const d = (v - pred) & 0xff;
        candidate[x] = d;
        score += d < 128 ? d : 256 - d;
      }
      if (score < bestScore) {
        bestScore = score;
        best = f;
        bestRow = candidate.slice();
      }
    }
    raw[y * (stride + 1)] = best;
    raw.set(bestRow, y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, img.width);
  view.setUint32(4, img.height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [
    Uint8Array.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((off, p) => (out.set(p, off), off + p.length), 0);
  return out;
}
