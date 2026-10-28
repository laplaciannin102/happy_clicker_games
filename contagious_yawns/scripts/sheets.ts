import type { IconKind } from '../src/data/images.ts';

/**
 * ChatGPT に「1枚に12個のアイコン」を描いてもらうためのシート（docs/ASSETS.md・docs/SHEET_PROMPTS.md）。
 * ここがシートの並びの正本。プロンプト（npm run images:prompts）と、切り分け（npm run images）の両方がこれを使う。
 * subject は ASSETS.md の表の Prompt と同じ文にする（tests/sheets.test.ts で確かめる）。
 */
export interface SheetCell {
  readonly kind: IconKind;
  readonly id: string;
  readonly subject: string;
}

export interface SheetDef {
  /** art/raw/sheets/<name>.png */
  readonly name: string;
  /** 左上から右へ、行ごとに。足りない分は空きマス */
  readonly cells: readonly SheetCell[];
}

/** シートのマス目（横 × 縦）。ChatGPT の横長 1536×1024 にちょうど収まる */
export const SHEET_COLUMNS = 4;
export const SHEET_ROWS = 3;

function cell(rows: readonly (readonly [IconKind, string, string])[]): SheetCell[] {
  return rows.map(([kind, id, subject]) => ({ kind, id, subject }));
}

export const SHEETS: readonly SheetDef[] = [
  {
    name: 'sheet1',
    cells: cell([
      ['producers', 'cat', "a sleepy cat curled up, half-closed eyes, mid-yawn"],
      ['producers', 'lecture', "an open textbook in front of a small chalkboard with wavy lines, a drowsy aura"],
      ['producers', 'meeting', "a briefcase and a long meeting table with a ticking clock above, drowsy mood"],
      ['producers', 'assembly', "a microphone on a stand on a school stage podium, sleepy morning sun"],
      ['producers', 'radio', "a retro radio playing soft music notes shaped like moons"],
      ['producers', 'kotatsu', "a cozy kotatsu table with a quilt and a bowl of mandarin oranges on top"],
      ['producers', 'local_train', "a small local train car in afternoon light, curtains half drawn"],
      ['producers', 'sheep', "three fluffy sheep in a row jumping over a little fence"],
      ['producers', 'moon', "a crescent moon with a face, yawning widely"],
      ['producers', 'front', "a soft drowsy cloud front with a weather map curve and sleepy face"],
      ['producers', 'galaxy', "a swirl galaxy with sleepy half-closed eyes in the center"],
      ['producers', 'big_yawn', "the whole universe shaped like an enormous yawning mouth full of stars"],
    ]),
  },
  {
    name: 'sheet2',
    cells: cell([
      ['stars', 'star', "a shooting star with a short glowing cream-yellow tail, friendly sparkle"],
      ['sheep', 'normal', "a fluffy white sheep running to the right, side view"],
      ['sheep', 'slow', "a fluffy white sheep walking slowly to the right with a sleepy face, side view"],
      ['sheep', 'feint', "a fluffy white sheep stopping short with a mischievous face, side view"],
      ['sheep', 'black', "a fluffy dark charcoal sheep running to the right, side view"],
      ['sheep', 'rare', "a fluffy white sheep with a tiny glowing halo, running to the right, side view"],
      ['sheep', 'fence', "a small wooden fence, front-side view, simple"],
      ['sheep', 'gold', "a fluffy golden sheep with shiny wool"],
      ['sheep', 'cloud', "a sheep made of a soft white cloud, floating"],
      ['sheep', 'star', "a sheep with tiny stars twinkling in its wool"],
      ['sheep', 'pajama', "a sheep wearing striped pajamas and a nightcap"],
      ['sheep', 'moon', "a pale sheep curled on a crescent moon"],
    ]),
  },
  {
    name: 'sheet3',
    cells: cell([
      ['challenges', 'coffee', "a steaming coffee mug with wide-awake eyes"],
      ['challenges', 'cats_only', "three sleepy cats sitting in a row"],
      ['challenges', 'all_nighter', "a city window at dawn with a tired desk lamp still on"],
      ['challenges', 'cram', "a tall stack of books with an alarm clock on top"],
      ['challenges', 'insomnia', "a wide-open eye under a moon, restless"],
      ['challenges', 'alarms', "many small alarm clocks ringing together"],
      ['challenges', 'rush_hour', "a packed commuter train car with hanging straps"],
      ['challenges', 'jet_lag', "an airplane between a sun and a moon, dizzy swirl"],
      ['warmth', 'w_entry', "a small round door glowing with dream light"],
      ['warmth', 'w_production', "a cute hot water bottle wrapped in a knitted cover"],
      ['warmth', 'w_auto_prestige', "an alarm clock with messy bed hair, crescent moon on its face"],
      ['warmth', 'w_fast_auto', "a tiny efficient secretary owl holding a clipboard, speed lines"],
    ]),
  },
  {
    name: 'sheet4',
    cells: cell([
      ['warmth', 'w_shards', "a fluffy blanket with sparkling dream crystals"],
      ['warmth', 'w_stars', "a skylight window with stars falling through"],
      ['warmth', 'w_auto', "a folder of papers with a speech bubble showing \"z\" shapes (no letters)"],
      ['warmth', 'w_offline', "a little house under a very long starry night"],
      ['warmth', 'w_chain', "a chain of linked soft rings glowing"],
      ['warmth', 'w_production2', "a warm winter sun over a sleepy field"],
      ['dream', 'root', "a crescent moon gate opening into a dream"],
      ['dream', 'm1', "a puffy futon bed"],
      ['dream', 'm2', "a cat sleeping on a pillow"],
      ['dream', 'm3', "a small cassette recorder next to a textbook"],
      ['dream', 'm4', "a person-shaped silhouette sinking into soft clouds, \"z\" shapes"],
      ['dream', 'm5', "a pillow made of fluffy sheep wool"],
    ]),
  },
  {
    name: 'sheet5',
    cells: cell([
      ['dream', 'm6', "a teacup with dreamy steam curling into stars"],
      ['dream', 'chain', "soft chain links spreading yawns from one to the next"],
      ['dream', 'm7', "a sleeping mask with a small star badge"],
      ['dream', 'm8', "a nightcap with a small crown"],
      ['dream', 'n1', "a speech bubble shaped like a yawn"],
      ['dream', 'n2', "a notebook with tally marks"],
      ['dream', 'n3', "a finger tapping softly, motion rings"],
      ['dream', 'n4', "a ledger book with a tiny abacus"],
      ['dream', 'n5', "a needle and thread over a pillow"],
      ['dream', 'n6', "a stack of neatly organized folders"],
      ['dream', 'n7', "a small friendly robot sewing a pillow"],
      ['dream', 'd1', "a small telescope pointing at the night sky"],
    ]),
  },
  {
    name: 'sheet6',
    cells: cell([
      ['dream', 'd2', "a city skyline under a deep night sky"],
      ['dream', 'd3', "a comet with a long glowing tail"],
      ['dream', 'd4', "a cozy house with a sleeping figure in the window"],
      ['dream', 'd5', "twinkling sparkles of a wish"],
      ['dream', 'd6', "a diary with a moon on the cover"],
      ['dream', 'd7', "a crystal ball showing a dream scene"],
      ['dream', 'cross', "a rainbow arching over three dream paths meeting"],
    ]),
  },
  {
    name: 'sheet7',
    cells: cell([
      ['lottery', 'moon', "a round slot-machine token showing a sleepy crescent moon"],
      ['lottery', 'star', "a round slot-machine token showing a smiling five-pointed star"],
      ['lottery', 'sheep', "a round slot-machine token showing a fluffy sheep face"],
      ['lottery', 'cloud', "a round slot-machine token showing a soft puffy cloud"],
      ['lottery', 'futon', "a round slot-machine token showing a folded futon with a pillow"],
      ['lottery', 'coffee', "a round slot-machine token showing a steaming coffee cup with wide-open eyes"],
      ['dream', 'encore', "a door made of starry night sky opening onto another, deeper dream"],
    ]),
  },
];

/** 共通のスタイル指定文（docs/ASSETS.md と同じ） */
export const STYLE =
  'soft pastel night-sky palette (lavender #8b7bd8, pale violet, cream yellow, misty blue), cute sleepy mood, ' +
  'rounded chunky shapes, thick soft outlines in dark indigo, flat shading with one gentle highlight, ' +
  'readable at 32x32 pixels, consistent sticker-like game icons';

/** ChatGPT に送る、シート1枚ぶんのプロンプト */
export function sheetPrompt(sheet: SheetDef): string {
  const total = SHEET_COLUMNS * SHEET_ROWS;
  const lines = Array.from({ length: total }, (_, i) => {
    const c = sheet.cells[i];
    const row = Math.floor(i / SHEET_COLUMNS) + 1;
    const col = (i % SHEET_COLUMNS) + 1;
    return `${i + 1}. (row ${row}, column ${col}) ${c ? c.subject : 'EMPTY - leave this cell completely blank'}`;
  });
  return [
    `Create ONE image: a sprite sheet of ${sheet.cells.length} separate game icons on an invisible grid of ` +
      `${SHEET_COLUMNS} columns x ${SHEET_ROWS} rows. Landscape 3:2 (1536x1024).`,
    '',
    `STYLE for every icon: ${STYLE}.`,
    '',
    'LAYOUT RULES:',
    '- Each icon is centered in its own cell and fills about 70% of the cell.',
    '- Leave clear empty space between icons. Icons must never touch or overlap each other.',
    '- All icons are about the same size and drawn in exactly the same style.',
    '- Transparent background (real alpha). If that is impossible, use one flat plain white background.',
    '- No grid lines, no borders, no frames, no numbers, no labels, no text, no shadows on the ground.',
    '',
    'CELLS (left to right, top to bottom):',
    ...lines,
  ].join('\n');
}

/** シートに入れず、1枚で大きく描いてもらう絵（512×512 で使う）。dawn は背景つきの1場面 */
export const SINGLES: readonly SheetCell[] = cell([
  [
    'main',
    'yawn',
    'a round soft character face doing a huge contagious yawn, eyes squeezed shut, small tear at the corner of one eye, tiny "z" shaped sparkles around, plush and huggable',
  ],
  [
    'main',
    'dawn',
    'a sleepy cat stretching on a windowsill as warm morning sunlight comes through parted curtains, the last few stars fading in a pale dawn sky',
  ],
]);

/** 背景まで描く1場面（エンディングの絵）。ほかは透過のキャラクター */
const SCENES = new Set(['main/dawn']);

/** 1枚だけ描いてもらうときのプロンプト */
export function singlePrompt(c: SheetCell): string {
  const rules = SCENES.has(`${c.kind}/${c.id}`)
    ? [
        'RULES: one small cozy scene inside a soft rounded vignette, centered, filling about 80% of the canvas.',
        'Transparent background outside the vignette (real alpha). No text, no letters, no frame.',
      ]
    : [
        'RULES: one subject, centered, filling about 80% of the canvas. Transparent background (real alpha);',
        'if that is impossible, one flat plain white background. No text, no letters, no frame, no background scenery.',
      ];
  return [
    'Create ONE image: a single game illustration, square 1:1 (1024x1024).',
    '',
    `STYLE: ${STYLE}.`,
    '',
    ...rules,
    '',
    `SUBJECT: ${c.subject}`,
  ].join('\n');
}
