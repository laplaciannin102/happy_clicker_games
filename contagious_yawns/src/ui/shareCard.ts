import { CREDITS } from '../data/credits';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { totalRate } from '../systems/production';
import { el } from './dom';
import { formatNumber } from './format';
import { imageUrl } from './icons';

/** 共有用の画像の大きさ（SNS のカードで一般的な 1.91:1） */
const CARD = { width: 1200, height: 630 } as const;
/** カードの色（夜空。画面のテーマに関係なく同じ） */
const COLORS = { top: '#2b2552', bottom: '#5b4fa8', text: '#fdf8e8', muted: '#cfc6f5', glow: 'rgba(255, 240, 180, 0.9)' } as const;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 星をちりばめる（毎回同じ位置になるよう、決まった式で置く） */
function drawStars(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.glow;
  for (let i = 0; i < 40; i++) {
    const x = (i * 197) % CARD.width;
    const y = (i * 113) % CARD.height;
    ctx.globalAlpha = 0.25 + ((i * 37) % 60) / 100;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 今の数を描いた共有用の画像（PNG）。ゲーム画面そのものではなく、数とキャラクターを描いたカード。 */
export async function drawShareCard(state: GameState): Promise<Blob | null> {
  const canvas = el('canvas');
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const notation = state.settings.notation;

  const bg = ctx.createLinearGradient(0, 0, 0, CARD.height);
  bg.addColorStop(0, COLORS.top);
  bg.addColorStop(1, COLORS.bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  drawStars(ctx);

  // 左にキャラクター（画像が無ければ絵文字）
  const src = imageUrl('main', 'yawn');
  const face = src ? await loadImage(src) : null;
  if (face) ctx.drawImage(face, 70, 135, 360, 360);
  else {
    ctx.font = `260px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('🥱', 110, 320);
  }

  // 右に題名・数・毎秒
  const s = ja.share;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.muted;
  ctx.font = `bold 44px ${font}`;
  ctx.fillText(s.cardTitle, 480, 170);
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold 120px ${font}`;
  const count = formatNumber(state.yawns, notation);
  ctx.fillText(count, 480, 330, 660);
  ctx.font = `bold 48px ${font}`;
  ctx.fillText(s.cardUnit, 480, 400);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `36px ${font}`;
  ctx.fillText(t(s.cardRate, { r: formatNumber(totalRate(state), notation) }), 480, 470, 660);
  ctx.font = `28px ${font}`;
  ctx.fillText(`#${CREDITS.hashtag}`, 480, 560);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
