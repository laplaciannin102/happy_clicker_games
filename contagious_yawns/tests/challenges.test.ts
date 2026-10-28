import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../src/data/challenges';
import { PRODUCER_BY_ID } from '../src/data/producers';
import { decodeSave, encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { migrate } from '../src/save/migrations';
import { createInitialState, type GameState } from '../src/state/gameState';
import { createAutomation, shouldAutoPrestige } from '../src/systems/automation';
import {
  abandonChallenge,
  challengeProductionNow,
  checkChallenge,
} from '../src/systems/challenges';
import { clickValue, performClick } from '../src/systems/click';
import { buyWarmthItem } from '../src/systems/hibernation';
import { doPrestige, startChallenge } from '../src/systems/prestige';
import { rateEach } from '../src/systems/production';
import { buyProducer, unitPrice, priceMultiplier } from '../src/systems/purchase';
import { tickStars } from '../src/systems/stars';
import { producerVisibility } from '../src/systems/unlock';
import { buyUpgrade, visibleUpgrades } from '../src/systems/upgrades';
import { challengeName, rewardText, ruleText } from '../src/ui/challengesPage';
import { playedState } from './helpers';

/** 1回冬眠したあとの状態 */
function afterHibernation(): GameState {
  const s = createInitialState(0, 1);
  s.hibernation.count = 1;
  return s;
}

function inChallenge(id: string): GameState {
  const s = afterHibernation();
  expect(startChallenge(s, id)).toBe(true);
  return s;
}

describe('チャレンジの定義', () => {
  it('8種、ID の重複なし、すべてに名前・制限・報酬の文がある', () => {
    expect(CHALLENGES).toHaveLength(8);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(8);
    for (const c of CHALLENGES) {
      expect(challengeName(c)).not.toBe(c.id);
      expect(ruleText(c.rule)).not.toBe('');
      expect(rewardText(c.reward)).not.toBe('');
    }
  });
});

describe('始める・終わる', () => {
  it('冬眠前は始められない', () => {
    expect(startChallenge(createInitialState(0, 1), 'coffee')).toBe(false);
  });

  it('始めると周回がリセットされ、挑戦中になる。挑戦中はほかを始められない', () => {
    const s = afterHibernation();
    s.yawns = new Decimal(1e9);
    s.totalYawns = s.yawns;
    s.producers.cat.bought = 30;
    expect(startChallenge(s, 'coffee')).toBe(true);
    expect(s.challenges.active).toBe('coffee');
    expect(s.yawns.toNumber()).toBe(0);
    expect(s.producers.cat.bought).toBe(0);
    expect(startChallenge(s, 'insomnia')).toBe(false);
    expect(startChallenge(s, 'nope')).toBe(false);
  });

  it('目標に届けばクリアし、報酬は残る。クリア済みはもう始められない', () => {
    const s = inChallenge('insomnia');
    s.totalYawns = new Decimal(CHALLENGES.find((c) => c.id === 'insomnia')?.goal ?? 0);
    expect(checkChallenge(s)).toEqual({ kind: 'completed', id: 'insomnia' });
    expect(s.challenges.active).toBeNull();
    expect(s.challenges.completed.has('insomnia')).toBe(true);
    expect(startChallenge(s, 'insomnia')).toBe(false);
    const base = createInitialState(0, 1);
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(rateEach(base, 'cat').toNumber() * 2);
  });

  it('一夜漬け：20分を過ぎたら失敗', () => {
    const s = inChallenge('cram');
    s.playTimeMs = 20 * 60_000 + 1;
    expect(checkChallenge(s)).toEqual({ kind: 'failed', id: 'cram' });
    expect(s.challenges.completed.size).toBe(0);
  });

  it('やめる・おやすみ・冬眠でも挑戦は終わる', () => {
    const a = inChallenge('coffee');
    abandonChallenge(a);
    expect(a.challenges.active).toBeNull();
    const b = inChallenge('coffee');
    b.totalYawns = new Decimal(1.5e8);
    doPrestige(b);
    expect(b.challenges.active).toBeNull();
  });
});

describe('制限', () => {
  it('コーヒー解禁：全生産 ×0.5', () => {
    const s = inChallenge('coffee');
    const free = afterHibernation();
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(rateEach(free, 'cat').toNumber() * 0.5);
  });

  it('猫しかいない：ほかの生産者は表示されず、買えない', () => {
    const s = inChallenge('cats_only');
    s.yawns = new Decimal(1e12);
    s.totalYawns = s.yawns;
    s.producers.meeting.bought = 1;
    expect(producerVisibility(s).assembly).toBe('hidden');
    expect(buyProducer(s, 'assembly', 1)).toBe(0);
    expect(buyProducer(s, 'cat', 1)).toBe(1);
  });

  it('徹夜明け：クリックしても何も起きない。そのかわり猫5匹から始める（改造とは判定しない）', () => {
    const s = inChallenge('all_nighter');
    expect(performClick(s).toNumber()).toBe(0);
    expect(s.clicks).toBe(0);
    expect(s.producers.cat.bought).toBe(5);
    s.lastSavedAt = s.createdAt;
    expect(checkIntegrity(s, Date.now())).toEqual([]);
  });

  it('目覚まし時計だらけ：流れ星が出ない', () => {
    const s = inChallenge('alarms');
    tickStars(s, 1e9, true);
    expect(s.stars.active).toBeNull();
  });

  it('不眠症：まくら工房を使えない', () => {
    const s = inChallenge('insomnia');
    s.yawns = new Decimal(1e6);
    s.clicks = 100;
    expect(visibleUpgrades(s)).toEqual([]);
    expect(buyUpgrade(s, 'click_1')).toBe(false);
  });

  it('満員電車：仲間の値段 ×10', () => {
    const s = inChallenge('rush_hour');
    expect(priceMultiplier(s)).toBe(10);
    expect(unitPrice(PRODUCER_BY_ID.cat, 0, priceMultiplier(s)).toNumber()).toBe(100);
  });

  it('時差ボケ：生産が 0.2〜1.8 倍に揺れる。揺れても改造と判定しない', () => {
    const s = inChallenge('jet_lag');
    const values = Array.from({ length: 60 }, (_, i) => {
      s.playTimeMs = i * 1000;
      return challengeProductionNow(s);
    });
    expect(Math.min(...values)).toBeCloseTo(0.2, 1);
    expect(Math.max(...values)).toBeCloseTo(1.8, 1);

    const p = playedState();
    p.hibernation.count = 1;
    p.challenges.active = 'jet_lag';
    // プレイ時間 15分ちょうどは周期の頭（いちばん小さい 0.2 倍）。小さいときにセーブしても検出しない
    expect(challengeProductionNow(p)).toBeCloseTo(0.2);
    expect(checkIntegrity(p, Date.now())).toEqual([]);
  });
});

describe('報酬', () => {
  it('コーヒー解禁：クリック ×1.5、満員電車：仲間の値段 ×0.9', () => {
    const s = afterHibernation();
    s.challenges.completed.add('coffee');
    s.challenges.completed.add('rush_hour');
    expect(clickValue(s).toNumber()).toBeCloseTo(1.5);
    expect(priceMultiplier(s)).toBeCloseTo(0.9);
  });

  it('一夜漬け：おやすみのあと 1億あくびから始める', () => {
    const s = afterHibernation();
    s.challenges.completed.add('cram');
    s.totalYawns = new Decimal(1.5e8);
    doPrestige(s);
    expect(s.yawns.toNumber()).toBe(1e8);
  });
});

describe('自動化の拡張', () => {
  it('オートおやすみ：解放して ON、得られるかけら ≥ 累計 × 割合 のとき', () => {
    const s = afterHibernation();
    s.totalYawns = new Decimal(1.5e8);
    s.prestige.shardsLifetime = 30;
    expect(shouldAutoPrestige(s)).toBe(false);
    s.hibernation.warmth = 2;
    buyWarmthItem(s, 'w_auto_prestige');
    expect(shouldAutoPrestige(s)).toBe(false);
    s.settings.autoPrestige = { enabled: true, ratio: 0.5 };
    expect(shouldAutoPrestige(s)).toBe(false); // 10 < 30 × 0.5
    s.settings.autoPrestige.ratio = 0.25;
    expect(shouldAutoPrestige(s)).toBe(true);
  });

  it('てきぱき秘書：自動購入が10倍速い', () => {
    const s = afterHibernation();
    s.prestige.nodes = new Set(['root', 'n1', 'n2']);
    s.hibernation.warmth = 3;
    buyWarmthItem(s, 'w_fast_auto');
    s.yawns = new Decimal(1e9);
    s.totalYawns = s.yawns;
    s.producers.cat.bought = 1;
    createAutomation().tick(s, 100);
    expect(s.producers.cat.bought).toBe(2);
  });
});

describe('セーブ', () => {
  it('チャレンジとオートおやすみの設定は往復で保たれる', async () => {
    const s = inChallenge('jet_lag');
    s.challenges.completed.add('coffee');
    s.settings.autoPrestige = { enabled: true, ratio: 2 };
    const back = await decodeSave(await encodeSave(s), { allowLegacyJson: false });
    expect(back.ok && back.value.state.challenges).toEqual(s.challenges);
    expect(back.ok && back.value.state.settings.autoPrestige).toEqual(s.settings.autoPrestige);
  });

  it('v9 → v10：チャレンジとオートおやすみの設定が足される', () => {
    expect(migrate({ settings: { notation: 'ja' } }, 9)).toMatchObject({
      challenges: { active: null, completed: [] },
      settings: { notation: 'ja', autoPrestige: { enabled: false, ratio: 0.5 } },
    });
  });
});
