import { ja } from '../i18n/ja';
import { presentation } from '../data/presentation';
import type { Preferences } from '../state/preferences';
import { node } from './dom';

export function createPreferencesPanel(read: () => Preferences, change: (value: Preferences) => void) {
  const panel = node('section', '', 'preferences-panel'); panel.append(node('h3', ja.presentationTitle), node('p', ja.presentationHint, 'small muted'));
  const themeLabel = node('label', ja.theme), theme = node('select');
  theme.setAttribute('aria-label', ja.theme);
  (['dark', 'light', 'system'] as const).forEach((value, i) => { const option = node('option', ja.themes[i]); option.value = value; theme.append(option); });
  themeLabel.append(theme); panel.append(themeLabel);
  theme.addEventListener('change', () => change({ ...read(), theme: theme.value as Preferences['theme'] }));
  const checkboxes = (['effects', 'sound'] as const).map((key, i) => {
    const label = node('label', i === 0 ? ja.effects : ja.sound), input = node('input'); input.type = 'checkbox';
    input.addEventListener('change', () => change({ ...read(), [key]: input.checked })); label.prepend(input); panel.append(label);
    return { key, input };
  });
  const volumeLabel = node('label', ja.volume), volume = node('input'), volumeValue = node('output');
  volume.type = 'range'; volume.min = '0'; volume.max = '100'; volume.step = '1';
  volume.setAttribute('aria-label', ja.volume);
  volumeLabel.append(volume, volumeValue); panel.append(volumeLabel);
  volume.addEventListener('input', () => change({ ...read(), volume: Number(volume.value) / 100 }));
  const intervalLabel = node('label', ja.autosaveInterval), interval = node('select');
  interval.setAttribute('aria-label', ja.autosaveInterval);
  presentation.autosaveSeconds.forEach(seconds => { const option = node('option', ja.seconds(seconds)); option.value = String(seconds); interval.append(option); });
  interval.addEventListener('change', () => change({ ...read(), autosaveSeconds: Number(interval.value) }));
  intervalLabel.append(interval); panel.append(intervalLabel, node('p', ja.reducedMotionHint, 'small muted'));
  function render() {
    const p = read(); if (theme.value !== p.theme) theme.value = p.theme;
    checkboxes.forEach(({ key, input }) => { if (input.checked !== p[key]) input.checked = p[key]; });
    const v = String(Math.round(p.volume * 100)); if (volume.value !== v) volume.value = v;
    if (volumeValue.value !== `${v}%`) volumeValue.value = `${v}%`;
    if (interval.value !== String(p.autosaveSeconds)) interval.value = String(p.autosaveSeconds);
  }
  return { panel, render };
}
