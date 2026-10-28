import Decimal from 'break_eternity.js';
import { producers } from './balance';

export interface Achievement {
  id: string; kind: 'owned' | 'earned' | 'clicks' | 'time' | 'events' | 'all' | 'prestige' | 'myth' | 'challenge';
  target: Decimal; producer: number; tier: number; hidden: boolean;
}
function group(kind: Achievement['kind'], values: (number | string)[]): Achievement[] {
  return values.map((target, tier) => ({ id: `${kind}-${tier}`, kind, target: new Decimal(target),
    producer: -1, tier, hidden: false }));
}
export const achievements: Achievement[] = [
  ...producers.flatMap((producer, index) => [1, 10, 25, 50].map((count, tier) => ({
    id: `${producer.id}-owned-${count}`, kind: 'owned' as const, target: new Decimal(count),
    producer: index, tier, hidden: false,
  }))),
  ...group('earned', [25, 100, 1000, 10000, 100000, 1000000, '1e8', '1e12']),
  ...group('clicks', [1, 10, 100, 1000, 10000]),
  ...group('time', [60, 600, 1800]),
  ...group('events', [1, 5, 20]),
  { id: 'secret-circle', kind: 'all', target: new Decimal(3), producer: -1, tier: 0, hidden: true },
  ...group('prestige', [1, 5, 10]),
  ...group('myth', [1, 2, 3]), ...group('challenge', [1, 3]),
];
