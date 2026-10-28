import { CHALLENGE_BY_ID } from '../data/challenges';
import { LOTTERY } from '../data/lottery';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { shouldAutoPrestige } from '../systems/automation';
import { checkChallenge } from '../systems/challenges';
import { canHibernate, doHibernate, nextSeason, shardsForNextWarmth, warmthForNow } from '../systems/hibernation';
import { doPrestige, shardsForRun, startChallenge } from '../systems/prestige';
import { effectsEnabled } from './appearance';
import { challengeName, rewardText } from './challengesPage';
import { seasonLabel } from './hibernationPage';
import { confirmChallenge, confirmHibernate, confirmPrestige } from './saveFlows';
import type { createSoundPlayer } from './sound';
import type { createToaster } from './toast';
import { playTransition } from './transition';

export interface LayerContext {
  getState(): GameState;
  render(): void;
  save(): Promise<boolean>;
  sound: ReturnType<typeof createSoundPlayer>;
  toaster: ReturnType<typeof createToaster>;
  checkAchievements(): void;
  /** 手でおやすみした（「二度寝」の計測用） */
  onPrestiged(): void;
}

/** プレステージ層（おやすみ・冬眠）とチャレンジの流れ：確認 → リセット → すぐセーブ。 */
export function createLayerFlows(ctx: LayerContext): {
  prestige(): Promise<void>;
  hibernate(): Promise<void>;
  beginChallenge(id: string): Promise<void>;
  checkChallengesAndAuto(): void;
} {
  const { sound, toaster } = ctx;

  /** おやすみのあと：夢くじが引けるようになった回だけ知らせる。 */
  function afterPrestige(state: GameState): void {
    if (state.prestige.count === LOTTERY.unlockPrestiges) toaster.show(ja.lottery.unlocked, 'special');
  }

  /** おやすみ（第1プレステージ）。 */
  async function prestige(): Promise<void> {
    const state = ctx.getState();
    const gain = shardsForRun(state);
    if (gain <= 0) return;
    if (!(await confirmPrestige(gain)) || ctx.getState() !== state) return;
    const gained = doPrestige(state);
    if (gained <= 0) return;
    ctx.onPrestiged();
    sound.play('prestige');
    if (effectsEnabled(state.settings)) playTransition(ja.transition.prestige, '🌙');
    toaster.show(t(ja.dream.done, { n: gained.toLocaleString('ja-JP') }));
    afterPrestige(state);
    ctx.checkAchievements();
    ctx.render();
    await ctx.save();
  }

  /** 冬眠（第2プレステージ）：季節が進む。 */
  async function hibernate(): Promise<void> {
    const state = ctx.getState();
    if (!canHibernate(state)) return;
    const season = seasonLabel(nextSeason(state));
    if (!(await confirmHibernate(warmthForNow(state), season, shardsForNextWarmth(state))) || ctx.getState() !== state) return;
    const gained = doHibernate(state);
    sound.play('hibernate');
    if (effectsEnabled(state.settings)) playTransition(ja.transition.hibernate, '🐻');
    toaster.show(t(ja.hibernation.done, { s: season, n: gained }));
    ctx.checkAchievements();
    ctx.render();
    await ctx.save();
  }

  /** チャレンジを始める：周回をリセットして挑戦する。 */
  async function beginChallenge(id: string): Promise<void> {
    const state = ctx.getState();
    const def = CHALLENGE_BY_ID.get(id);
    if (!def || state.challenges.active !== null) return;
    if (!(await confirmChallenge(challengeName(def))) || ctx.getState() !== state) return;
    if (!startChallenge(state, id)) return;
    ctx.render();
    await ctx.save();
  }

  /** チャレンジのクリア・失敗と、オートおやすみ（実績と同じ間隔で確かめる）。 */
  function checkChallengesAndAuto(): void {
    const state = ctx.getState();
    const result = checkChallenge(state);
    if (result) {
      const def = CHALLENGE_BY_ID.get(result.id);
      if (def) {
        toaster.show(
          result.kind === 'completed'
            ? t(ja.challenge.cleared, { name: challengeName(def), reward: rewardText(def.reward) })
            : t(ja.challenge.failed, { name: challengeName(def) }),
          result.kind === 'completed' ? 'special' : 'warn',
        );
        sound.play(result.kind === 'completed' ? 'challengeClear' : 'denied');
      }
      ctx.render();
      void ctx.save();
    }
    if (shouldAutoPrestige(state)) {
      const gained = doPrestige(state);
      if (gained > 0) {
        sound.play('prestige');
        toaster.show(t(ja.autoPrestige.done, { n: gained.toLocaleString('ja-JP') }));
        afterPrestige(state);
        ctx.render();
        void ctx.save();
      }
    }
  }

  return { prestige, hibernate, beginChallenge, checkChallengesAndAuto };
}
