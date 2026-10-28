import { crc32, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng, hasTransparency, resizeContain, type RgbaImage } from '../scripts/png';

function solid(width: number, height: number, rgba: readonly number[]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(rgba, i * 4);
  return { width, height, data };
}

function pixel(img: RgbaImage, x: number, y: number): number[] {
  const o = (y * img.width + x) * 4;
  return [...img.data.subarray(o, o + 4)];
}

/** RGB（色の形式 2・フィルターなし）の PNG を手で作る。ChatGPT が透過なしで出したときの形 */
function rgbPng(width: number, height: number, rgb: readonly number[]): Uint8Array {
  const chunk = (type: string, body: Uint8Array): number[] => {
    const typed = [...type].map((c) => c.charCodeAt(0));
    const len = [body.length >>> 24, (body.length >>> 16) & 255, (body.length >>> 8) & 255, body.length & 255];
    const crc = crc32(Uint8Array.from([...typed, ...body]));
    return [...len, ...typed, ...body, crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255];
  };
  const ihdr = Uint8Array.from([0, 0, 0, width, 0, 0, 0, height, 8, 2, 0, 0, 0]);
  const rows: number[] = [];
  for (let y = 0; y < height; y++) rows.push(0, ...Array.from({ length: width }, () => rgb).flat());
  return Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', deflateSync(Uint8Array.from(rows))),
    ...chunk('IEND', new Uint8Array(0)),
  ]);
}

describe('PNG の読み書き', () => {
  it('書いて読むと同じ画素に戻る（グラデーションと半透明）', () => {
    const img = solid(7, 5, [0, 0, 0, 0]);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) img.data.set([x * 30, y * 50, 200, (x * y * 20) % 256], (y * 7 + x) * 4);
    const back = decodePng(encodePng(img));
    expect(back.width).toBe(7);
    expect(back.height).toBe(5);
    expect([...back.data]).toEqual([...img.data]);
  });

  it('透過なしの RGB PNG も読める（不透明として扱う）', () => {
    const img = decodePng(rgbPng(3, 2, [10, 20, 30]));
    expect(pixel(img, 2, 1)).toEqual([10, 20, 30, 255]);
    expect(hasTransparency(img)).toBe(false);
  });

  it('PNG でないものはわかりやすいエラーにする', () => {
    expect(() => decodePng(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toThrow(/PNG ではありません/);
  });
});

describe('縮小', () => {
  it('同じ色の画像は、縮めても同じ色', () => {
    const out = resizeContain(solid(64, 64, [139, 123, 216, 255]), 8);
    expect(out.width).toBe(8);
    expect(pixel(out, 3, 5)).toEqual([139, 123, 216, 255]);
  });

  it('1024 → 128 で、左半分と右半分の色が分かれたまま', () => {
    const img = solid(1024, 1024, [255, 0, 0, 255]);
    for (let y = 0; y < 1024; y++) for (let x = 512; x < 1024; x++) img.data.set([0, 0, 255, 255], (y * 1024 + x) * 4);
    const out = resizeContain(img, 128);
    expect(pixel(out, 10, 64)).toEqual([255, 0, 0, 255]);
    expect(pixel(out, 117, 64)).toEqual([0, 0, 255, 255]);
  });

  it('透明なふちは黒ずまない（色は不透明な部分の色のまま、不透明度だけ下がる）', () => {
    // 左半分が透明（色の値は黒）、右半分が白
    const img = solid(4, 4, [0, 0, 0, 0]);
    for (let y = 0; y < 4; y++) for (let x = 2; x < 4; x++) img.data.set([255, 255, 255, 255], (y * 4 + x) * 4);
    const out = resizeContain(img, 1);
    expect(pixel(out, 0, 0)).toEqual([255, 255, 255, 128]);
  });

  it('正方形でなければ、縦横比を保って中央に置き、余白は透明', () => {
    const out = resizeContain(solid(200, 100, [0, 200, 0, 255]), 100);
    expect(out.width).toBe(100);
    expect(out.height).toBe(100);
    expect(pixel(out, 50, 10)).toEqual([0, 0, 0, 0]);
    expect(pixel(out, 50, 50)).toEqual([0, 200, 0, 255]);
    expect(pixel(out, 50, 90)).toEqual([0, 0, 0, 0]);
    expect(hasTransparency(out)).toBe(true);
  });
});
