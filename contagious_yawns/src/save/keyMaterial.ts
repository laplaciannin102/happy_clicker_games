/**
 * セーブ署名用の鍵（SPEC §6.3-1）。
 * 文字列のまま置かず、8バイトずつに分けて並べ替え、位置ごとのマスクで XOR している。
 * クライアントだけのゲームなので鍵は必ず手元にある。これは時間稼ぎでしかない。
 */
const FRAGMENTS: readonly (readonly number[])[] = [
  [202, 29, 190, 86, 53, 23, 2, 189],
  [164, 237, 9, 149, 216, 206, 11, 123],
  [204, 171, 246, 59, 34, 202, 240, 60],
  [15, 177, 10, 172, 195, 17, 117, 93],
];

/** FRAGMENTS[i] が元の何番目の塊か */
const ORDER = [2, 0, 3, 1] as const;

const mask = (i: number): number => (i * 73 + 29) & 255;

export function signingKeyBytes(): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(32);
  ORDER.forEach((chunk, stored) => {
    const fragment = FRAGMENTS[stored] ?? [];
    fragment.forEach((byte, j) => {
      const pos = chunk * 8 + j;
      out[pos] = byte ^ mask(pos);
    });
  });
  return out;
}
