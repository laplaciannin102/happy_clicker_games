import { presentation } from '../data/presentation';
import type { Preferences } from '../state/preferences';
import { node } from './dom';

export function motionAllowed(preferences: Preferences, reduced: boolean): boolean { return preferences.effects && !reduced; }
export function createFeedback(read: () => Preferences) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), systemDark = matchMedia('(prefers-color-scheme: dark)');
  let active = 0;
  function apply() {
    const p = read();
    document.documentElement.dataset.theme = p.theme === 'system' ? systemDark.matches ? 'dark' : 'light' : p.theme;
    document.documentElement.dataset.motion = motionAllowed(p, reduced.matches) ? 'on' : 'off';
  }
  reduced.addEventListener('change', apply); systemDark.addEventListener('change', apply);
  function pulse(element: HTMLElement) {
    if (!motionAllowed(read(), reduced.matches) || !element.animate) return;
    element.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.25)' }, { filter: 'brightness(1)' }], { duration: 300 });
  }
  function float(element: HTMLElement, text: string) {
    if (!motionAllowed(read(), reduced.matches) || active >= presentation.maxFloatingLabels) return;
    const label = node('span', text, 'floating-rumor'); label.setAttribute('aria-hidden', 'true'); element.append(label); active++;
    setTimeout(() => { label.remove(); active--; }, presentation.effectDurationMs);
  }
  return { apply, pulse, float };
}
