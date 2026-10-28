export const presentation = {
  autosaveSeconds: [15, 30, 60] as const,
  offlineBudgetMs: 8, offlineStepSeconds: 1,
  effectDurationMs: 650, maxFloatingLabels: 5, soundCooldownMs: 90,
  sounds: { click: [330], buy: [392, 494], research: [440, 554, 659], event: [523, 659, 784],
    achievement: [392, 494, 587, 784], reset: [262, 392, 523, 784] },
} as const;
