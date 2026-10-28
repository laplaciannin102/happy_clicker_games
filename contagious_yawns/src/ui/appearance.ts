import type { Settings } from '../state/gameState';

/**
 * テーマと演出の設定を <html> に反映する（CSS は data-theme / data-effects を見る）。
 * テーマが auto のときは属性を外し、OS の設定（prefers-color-scheme）に任せる。
 */
export function applyAppearance(settings: Pick<Settings, 'theme' | 'effects'>): void {
  const html = document.documentElement;
  if (settings.theme === 'auto') delete html.dataset.theme;
  else if (html.dataset.theme !== settings.theme) html.dataset.theme = settings.theme;
  const effects = settings.effects ? 'on' : 'off';
  if (html.dataset.effects !== effects) html.dataset.effects = effects;
}

/** 演出を出してよいか（設定で OFF、または OS で「視差効果を減らす」なら出さない）。 */
export function effectsEnabled(settings: Pick<Settings, 'effects'>): boolean {
  if (!settings.effects) return false;
  return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
