import type { IconKind } from '../data/images';

/**
 * 画像（docs/ASSETS.md）。src/assets/images/<種類>/<ID>.png を置くと、その絵文字の代わりに使う。
 * 置かれた画像だけがビルドに入るので、無い画像を読みにいって 404 になることはない（DESIGN.md §13）。
 */
const IMAGES = import.meta.glob<string>('../assets/images/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function imageUrl(kind: IconKind, id: string): string | undefined {
  return IMAGES[`../assets/images/${kind}/${id}.png`];
}

/**
 * アイコンの中身を入れ替える。画像があれば <img>、なければ絵文字（プレースホルダー）。
 * 同じ中身なら DOM を書き換えない。
 */
export function setIcon(node: HTMLElement, kind: IconKind, id: string, emoji: string): void {
  const url = imageUrl(kind, id);
  const key = url ?? `text:${emoji}`;
  if (node.dataset.icon === key) return;
  node.dataset.icon = key;
  if (url === undefined) {
    node.textContent = emoji;
    return;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  img.className = 'icon-image';
  img.decoding = 'async';
  img.draggable = false;
  node.replaceChildren(img);
}

/** 画像を使わない文字だけのアイコン（未解放の「？」など）。 */
export function setIconText(node: HTMLElement, text: string): void {
  const key = `text:${text}`;
  if (node.dataset.icon === key) return;
  node.dataset.icon = key;
  node.textContent = text;
}

/** アイコン用の span を作る（飾りなので読み上げない）。 */
export function iconSpan(className: string, kind: IconKind, id: string, emoji: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  node.setAttribute('aria-hidden', 'true');
  setIcon(node, kind, id, emoji);
  return node;
}
