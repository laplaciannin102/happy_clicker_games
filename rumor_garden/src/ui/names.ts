import { ja } from '../i18n/ja';
import type { Upgrade } from '../data/upgrades';
import type { Achievement } from '../data/achievements';
import { formatNumber } from './format';

export function upgradeName(upgrade: Upgrade): string {
  return upgrade.producer === null ? ja.clickResearchNames[upgrade.tier]
    : ja.upgradeName(ja.producerNames[upgrade.producer], ja.researchTiers[upgrade.tier]);
}
export function achievementName(achievement: Achievement): string {
  const target = formatNumber(achievement.target, 'ja');
  switch (achievement.kind) {
    case 'owned': return ja.achievementOwned(ja.producerNames[achievement.producer], target);
    case 'earned': return ja.achievementEarned(target);
    case 'clicks': return ja.achievementClicks(target);
    case 'time': return ja.achievementTime(target);
    case 'events': return ja.achievementEvents(target);
    case 'all': return ja.secretAchievement;
    case 'prestige': return ja.achievementPrestige(target);
    case 'myth': return ja.achievementMyth(target);
    case 'challenge': return ja.achievementChallenge(target);
  }
}
