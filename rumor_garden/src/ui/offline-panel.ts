import { ja } from '../i18n/ja';
import { node } from './dom';
export function createOfflinePanel() {
  const overlay = node('div', '', 'offline-overlay'); overlay.hidden = true;
  const card = node('section', '', 'panel'), title = node('h2', ja.offlineWorking), text = node('p');
  text.setAttribute('role', 'status'); const progress = node('progress'); progress.max = 1;
  progress.setAttribute('aria-label', ja.offlineWorking); card.append(title, text, progress); overlay.append(card); document.body.append(overlay);
  return { show(fraction: number) { overlay.hidden = false; progress.value = fraction;
    const value = ja.offlineProgress(Math.floor(fraction * 20) * 5); if (text.textContent !== value) text.textContent = value; },
    hide() { overlay.hidden = true; } };
}
