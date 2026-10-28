/**
 * 画像の書き出し（npm run images）。docs/ASSETS.md も参照。
 * - シート：art/raw/sheets/<name>.png（1枚に12個）を切り分けて、src/assets/images/<種類>/<ID>.png に書き出す。
 * - 1枚ずつ：art/raw/<種類>/<ID>.png を縮めて書き出す（シートより優先。描き直したい絵だけ差し替えるとき用）。
 * 書き出し先のほうが新しければ飛ばす（--force で全部やり直す）。
 * npm run images:prompts で、シートのプロンプト集（docs/SHEET_PROMPTS.md）を作り直す。
 * 依存パッケージは使わない（PNG の読み書きは scripts/png.ts、切り分けは scripts/slice.ts）。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { ICON_KINDS, ICON_SIZE, type IconKind } from '../src/data/images.ts';
import { decodePng, encodePng, hasTransparency, resizeContain, type RgbaImage } from './png.ts';
import { SHEETS, SHEET_COLUMNS, SHEET_ROWS, SINGLES, sheetPrompt, singlePrompt } from './sheets.ts';
import { removeBackground, sliceSheet } from './slice.ts';

const RAW_DIR = join('art', 'raw');
const SHEET_DIR = join(RAW_DIR, 'sheets');
const OUT_DIR = join('src', 'assets', 'images');
const PROMPTS_FILE = join('docs', 'SHEET_PROMPTS.md');
/** シートから切り出した絵は、マスいっぱいにせず周りを少し空ける */
const SHEET_CONTENT = 0.9;
/** ID に使える文字（src/data の ID と同じ形） */
const ID_PATTERN = /^[a-z0-9_]+$/;

const isKind = (name: string): name is IconKind => ICON_KINDS.some((k) => k === name);
const outPath = (kind: IconKind, id: string): string => join(OUT_DIR, kind, `${id}.png`);
const rawPath = (kind: IconKind, id: string): string => join(RAW_DIR, kind, `${id}.png`);
const newer = (a: string, b: string): boolean => existsSync(a) && statSync(a).mtimeMs >= statSync(b).mtimeMs;

const count = { done: 0, skipped: 0, failed: 0 };

function write(kind: IconKind, id: string, image: RgbaImage, from: string): void {
  mkdirSync(join(OUT_DIR, kind), { recursive: true });
  const out = outPath(kind, id);
  writeFileSync(out, encodePng(image));
  console.log(`✓ ${from} → ${out}`);
  count.done++;
}

function processSheets(force: boolean): void {
  if (!existsSync(SHEET_DIR)) return;
  for (const sheet of SHEETS) {
    const src = join(SHEET_DIR, `${sheet.name}.png`);
    if (!existsSync(src)) continue;
    // 1枚ずつの絵が置いてあるものは、そちらを使う
    const cells = sheet.cells.map((c) => (existsSync(rawPath(c.kind, c.id)) ? null : c));
    if (!force && cells.every((c) => c === null || newer(outPath(c.kind, c.id), src))) {
      count.skipped += cells.filter((c) => c !== null).length;
      continue;
    }
    try {
      const { image, removed } = removeBackground(decodePng(readFileSync(src)));
      if (removed) console.warn(`⚠ ${src}：背景が透明ではないので、ふちから続く背景色を消しました（仕上がりを確かめてください）`);
      const parts = sliceSheet(image, SHEET_COLUMNS, SHEET_ROWS);
      parts.forEach((part, i) => {
        const c = sheet.cells[i];
        const where = `${src} の ${i + 1}番`;
        if (!c) {
          if (part) console.warn(`⚠ ${where}：空きマスのはずの場所に絵があります（無視しました）`);
          return;
        }
        if (cells[i] === null) return;
        if (!part) {
          console.error(`✗ ${where}（${c.kind}/${c.id}）：絵が見つかりません`);
          count.failed++;
          return;
        }
        const size = ICON_SIZE[c.kind];
        write(c.kind, c.id, resizeContain(part, size, Math.round(size * SHEET_CONTENT)), where);
      });
    } catch (e) {
      console.error(`✗ ${src}：${e instanceof Error ? e.message : String(e)}`);
      count.failed++;
    }
  }
}

function processSingles(force: boolean): void {
  for (const dir of readdirSync(RAW_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === 'sheets') continue;
    if (!isKind(dir.name)) {
      console.warn(`⚠ 知らない種類のフォルダ：${dir.name}（使えるのは sheets, ${ICON_KINDS.join(', ')}）`);
      continue;
    }
    const kind = dir.name;
    for (const file of readdirSync(join(RAW_DIR, kind), { withFileTypes: true })) {
      if (!file.isFile()) continue;
      const src = join(RAW_DIR, kind, file.name);
      const id = basename(file.name, extname(file.name));
      if (extname(file.name).toLowerCase() !== '.png') {
        console.warn(`⚠ ${src}：PNG ではないので飛ばしました`);
        count.failed++;
        continue;
      }
      if (!ID_PATTERN.test(id)) {
        console.warn(`⚠ ${src}：ファイル名は半角の小文字・数字・_ だけにしてください（例：local_train.png）`);
        count.failed++;
        continue;
      }
      if (!force && newer(outPath(kind, id), src)) {
        count.skipped++;
        continue;
      }
      try {
        const image = decodePng(readFileSync(src));
        if (!hasTransparency(image)) console.warn(`⚠ ${src}：背景が透明ではありません（そのまま書き出します）`);
        if (image.width !== image.height) console.warn(`⚠ ${src}：正方形ではないので、余白を透明にして中央に置きます`);
        write(kind, id, resizeContain(image, ICON_SIZE[kind]), src);
      } catch (e) {
        console.error(`✗ ${src}：${e instanceof Error ? e.message : String(e)}`);
        count.failed++;
      }
    }
  }
}

/** docs/SHEET_PROMPTS.md を作る（ChatGPT にそのまま貼る文） */
function writePrompts(): void {
  const parts = [
    '# SHEET_PROMPTS — ChatGPT に貼るプロンプト集',
    '',
    '`npm run images:prompts` で `scripts/sheets.ts` から作ったファイルです。手で直さず、直すときは `scripts/sheets.ts` を直して作り直します。',
    '使い方は docs/ASSETS.md の「ChatGPT でまとめて作る」を見てください。',
    '',
    ...SHEETS.flatMap((sheet, i) => [
      `## ${i + 1}. ${sheet.name}（${sheet.cells.length}個）→ \`art/raw/sheets/${sheet.name}.png\` に保存`,
      '',
      ...(i > 0 ? ['（1枚目の画像を添付してから送ると、絵柄がそろいます）', ''] : []),
      '```',
      sheetPrompt(sheet),
      '```',
      '',
    ]),
    ...SINGLES.flatMap((c, i) => [
      `## ${SHEETS.length + i + 1}. ${c.kind}/${c.id}（1枚で大きく）→ \`art/raw/${c.kind}/${c.id}.png\` に保存`,
      '',
      '（1枚目のシートを添付してから送ると、絵柄がそろいます）',
      '',
      '```',
      singlePrompt(c),
      '```',
      '',
    ]),
  ];
  writeFileSync(PROMPTS_FILE, new TextEncoder().encode(parts.join('\n')));
  console.log(`✓ ${PROMPTS_FILE}（シート ${SHEETS.length}枚）`);
}

function main(): void {
  if (process.argv.includes('--prompts')) {
    writePrompts();
    return;
  }
  const force = process.argv.includes('--force');
  if (!existsSync(RAW_DIR)) {
    console.log(`${RAW_DIR} がありません。docs/ASSETS.md の手順で ChatGPT の画像を置いてください。`);
    return;
  }
  processSheets(force);
  processSingles(force);
  console.log(`書き出し ${count.done}枚・変更なし ${count.skipped}枚・失敗 ${count.failed}枚`);
  if (count.failed > 0) process.exitCode = 1;
}

main();
