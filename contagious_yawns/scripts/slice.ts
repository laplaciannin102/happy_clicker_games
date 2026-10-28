import { hasTransparency, type RgbaImage } from './png.ts';

/** これより不透明な画素を「絵」とみなす */
const SOLID_ALPHA = 24;
/** 背景とみなす色の近さ（RGB の距離） */
const BG_DISTANCE = 40;
/** これより小さいかたまり（ゴミ）は無視する（マスの面積に対する割合） */
const MIN_PART = 0.0005;

/**
 * 背景が透明でなければ、ふちから続く背景色を透明にする。
 * 背景色は四隅の色。白っぽい無彩色（白・市松模様）も背景とみなす。絵の中は輪郭線で守られるので消えない。
 */
export function removeBackground(img: RgbaImage): { image: RgbaImage; removed: boolean } {
  if (hasTransparency(img)) return { image: img, removed: false };
  const { width: w, height: h } = img;
  const data = img.data.slice();
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const bg = [0, 1, 2].map((c) => corners.reduce((s, p) => s + (data[p * 4 + c] ?? 0), 0) / corners.length);
  const isBg = (p: number): boolean => {
    const r = data[p * 4] ?? 0;
    const g = data[p * 4 + 1] ?? 0;
    const b = data[p * 4 + 2] ?? 0;
    const near = Math.hypot(r - (bg[0] ?? 0), g - (bg[1] ?? 0), b - (bg[2] ?? 0)) < BG_DISTANCE;
    const lightGray = Math.max(r, g, b) - Math.min(r, g, b) < 18 && Math.min(r, g, b) > 170;
    return near || lightGray;
  };
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length > 0) {
    const p = stack.pop() ?? 0;
    if (seen[p] || !isBg(p)) continue;
    seen[p] = 1;
    data[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  return { image: { width: w, height: h, data }, removed: true };
}

/**
 * シートをマス目ごとの絵に切り分ける。マス目の線どおりに切るのではなく、
 * つながった絵のかたまりを見つけて、重心のあるマスに割り当てる（ChatGPT の絵は少しずれるので）。
 * 戻り値はマスの順（左上から右へ）。絵が無いマスは null。
 */
export function sliceSheet(img: RgbaImage, columns: number, rows: number): (RgbaImage | null)[] {
  const { width: w, height: h } = img;
  const cellW = w / columns;
  const cellH = h / rows;
  const minArea = Math.max(12, cellW * cellH * MIN_PART);
  const label = new Int32Array(w * h);
  const cellOf: number[] = [0];
  const boxes = Array.from({ length: columns * rows }, () => ({ x0: w, y0: h, x1: -1, y1: -1 }));

  let next = 1;
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== 0 || (img.data[start * 4 + 3] ?? 0) <= SOLID_ALPHA) continue;
    // かたまりを塗り分けて、面積・重心・範囲を数える
    const id = next++;
    const members: number[] = [];
    const stack = [start];
    label[start] = id;
    while (stack.length > 0) {
      const p = stack.pop() ?? 0;
      members.push(p);
      const x = p % w;
      const around = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < w * (h - 1) ? p + w : -1];
      for (const q of around) {
        if (q < 0 || label[q] !== 0 || (img.data[q * 4 + 3] ?? 0) <= SOLID_ALPHA) continue;
        label[q] = id;
        stack.push(q);
      }
    }
    if (members.length < minArea) {
      cellOf[id] = -1;
      continue;
    }
    let sx = 0;
    let sy = 0;
    for (const p of members) {
      sx += p % w;
      sy += Math.floor(p / w);
    }
    const col = Math.min(columns - 1, Math.floor(sx / members.length / cellW));
    const row = Math.min(rows - 1, Math.floor(sy / members.length / cellH));
    const cell = row * columns + col;
    cellOf[id] = cell;
    const box = boxes[cell];
    if (!box) continue;
    for (const p of members) {
      const x = p % w;
      const y = Math.floor(p / w);
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x);
      box.y1 = Math.max(box.y1, y);
    }
  }

  return boxes.map((box, cell) => {
    if (box.x1 < 0) return null;
    const cw = box.x1 - box.x0 + 1;
    const ch = box.y1 - box.y0 + 1;
    const data = new Uint8Array(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const p = (box.y0 + y) * w + box.x0 + x;
        const owner = label[p] ?? 0;
        // このマスのかたまりと、うすいふち（どのかたまりにも入らない画素）だけ写す
        if (owner !== 0 && cellOf[owner] !== cell) continue;
        data.set(img.data.subarray(p * 4, p * 4 + 4), (y * cw + x) * 4);
      }
    }
    return { width: cw, height: ch, data };
  });
}
