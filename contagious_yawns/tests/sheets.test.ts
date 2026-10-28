import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasTransparency, type RgbaImage } from '../scripts/png';
import { SHEETS, SHEET_COLUMNS, SHEET_ROWS, SINGLES, sheetPrompt, singlePrompt } from '../scripts/sheets';
import { removeBackground, sliceSheet } from '../scripts/slice';

const readText = (path: string): string => new TextDecoder().decode(readFileSync(path));

/** ASSETS.md の表：`種類/ID.png` → Prompt 列 */
function assetRows(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of readText('docs/ASSETS.md').split('\n')) {
    const m = /^\| `([a-z]+\/[a-z0-9_]+)\.png` \|(.*)\|\s*$/.exec(line);
    const cols = m?.[2]?.split('|').map((c) => c.trim());
    if (m?.[1] && cols) rows.set(m[1], cols[cols.length - 1] ?? '');
  }
  return rows;
}

describe('シートの割り当て', () => {
  const all = [...SHEETS.flatMap((s) => s.cells), ...SINGLES];

  it('ASSETS.md の表の画像が、シートか1枚描きのどちらかにちょうど1回ずつ入っていて、文も同じ', () => {
    const rows = assetRows();
    expect(rows.size).toBeGreaterThan(60);
    const keys = all.map((c) => `${c.kind}/${c.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...rows.keys()].sort());
    for (const c of all) expect(c.subject).toBe(rows.get(`${c.kind}/${c.id}`));
  });

  it('1枚のシートはマス目の数まで。名前は重ならない', () => {
    for (const s of SHEETS) expect(s.cells.length).toBeLessThanOrEqual(SHEET_COLUMNS * SHEET_ROWS);
    expect(new Set(SHEETS.map((s) => s.name)).size).toBe(SHEETS.length);
  });

  it('プロンプト集（docs/SHEET_PROMPTS.md）が最新（npm run images:prompts で作り直す）', () => {
    const doc = readText('docs/SHEET_PROMPTS.md');
    for (const s of SHEETS) expect(doc).toContain(sheetPrompt(s));
    for (const c of SINGLES) expect(doc).toContain(singlePrompt(c));
  });
});

/** 4×3 のシートを作る。filled のマスに円（中心から少しずらす）を描く */
function fakeSheet(filled: readonly number[], background: readonly number[]): RgbaImage {
  const w = 400;
  const h = 300;
  const data = new Uint8Array(w * h * 4);
  for (let p = 0; p < w * h; p++) data.set(background, p * 4);
  const dot = (cx: number, cy: number, r: number, rgba: readonly number[]): void => {
    for (let y = Math.max(0, cy - r); y < Math.min(h, cy + r); y++)
      for (let x = Math.max(0, cx - r); x < Math.min(w, cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) data.set(rgba, (y * w + x) * 4);
  };
  for (const i of filled) {
    const cx = (i % 4) * 100 + 50 + ((i * 7) % 15) - 7;
    const cy = Math.floor(i / 4) * 100 + 50 + ((i * 5) % 13) - 6;
    dot(cx, cy, 30, [40, 30, 90, 255]); // 輪郭
    dot(cx, cy, 26, [139, 123, 216, 255]);
    dot(cx + 34, cy - 30, 5, [40, 30, 90, 255]); // 離れたきらきら（同じマスに入る）
  }
  return { width: w, height: h, data };
}

describe('シートの切り分け', () => {
  it('絵のあるマスだけ切り出し、離れたきらきらも同じ絵に入れる', () => {
    const parts = sliceSheet(fakeSheet([0, 1, 5, 11], [0, 0, 0, 0]), 4, 3);
    expect(parts.map((p) => p !== null)).toEqual([true, true, false, false, false, true, false, false, false, false, false, true]);
    // 円（直径60）＋右上のきらきらで、横幅は 60 より広い
    expect(parts[0]?.width).toBeGreaterThan(65);
  });

  it('白い背景は消して透明にする。絵の中の色は残す', () => {
    const { image, removed } = removeBackground(fakeSheet([2, 7], [255, 255, 255, 255]));
    expect(removed).toBe(true);
    expect(hasTransparency(image)).toBe(true);
    const parts = sliceSheet(image, 4, 3);
    expect(parts.filter((p) => p !== null)).toHaveLength(2);
    const part = parts[2];
    const mid = part ? ((part.height >> 1) * part.width + (part.width >> 1) - 10) * 4 : 0;
    expect([...(part?.data.subarray(mid, mid + 4) ?? [])]).toEqual([139, 123, 216, 255]);
  });

  it('市松模様の背景（白と薄い灰色）も消す', () => {
    const img = fakeSheet([4], [255, 255, 255, 255]);
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const p = (y * img.width + x) * 4;
        if (img.data[p] === 255 && (Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 1) img.data.set([204, 204, 204, 255], p);
      }
    const parts = sliceSheet(removeBackground(img).image, 4, 3);
    expect(parts.filter((p) => p !== null)).toHaveLength(1);
    expect(parts[4]?.width).toBeLessThan(90);
  });
});
