import { HIDDEN_RULES } from '../data/achievements';
import { ENDING } from '../data/ending';
import { SHEEP_GAME } from '../data/minigames';
import { ja, t } from '../i18n/ja';
import { lotteryGame, respinLottery } from '../minigames/lottery';
import { sheepGame, type SheepReward } from '../minigames/sheep';
import { playSheep } from '../minigames/sheep/view';
import type { GameState } from '../state/gameState';
import { unlockEventAchievement } from '../systems/achievements';
import { buyEncore } from '../systems/dreamTree';
import { awaken } from '../systems/ending';
import { effectsEnabled } from './appearance';
import { confirmDialog } from './dialog';
import { playEnding } from './endingSection';
import { lotteryPrizeText } from './lotteryPage';
import type { createSoundPlayer } from './sound';
import type { createToaster } from './toast';

export interface PlayContext {
  getState(): GameState;
  render(): void;
  save(): Promise<boolean>;
  sound: ReturnType<typeof createSoundPlayer>;
  toaster: ReturnType<typeof createToaster>;
  showSheepResult(reward: SheepReward): void;
  /** 解除した実績を知らせる */
  announce(ids: readonly string[]): void;
  /** 実績の条件を確かめる */
  checkAchievements(): void;
}

/** ミニゲーム（羊を数える・夢くじ）と、夢の続き・めざめの流れ。DOM の組み立ては各ページに任せる。 */
export function createPlayFlows(ctx: PlayContext): {
  countSheep(): Promise<void>;
  drawLottery(): Promise<void>;
  respinLottery(held: readonly boolean[]): void;
  settleLottery(): void;
  buyEncore(): void;
  awaken(): Promise<void>;
} {
  const { sound, toaster } = ctx;
  let playing = false;

  /** 羊を数える：費用を払ってすぐセーブ（リロードで払い戻せないように）→ 遊ぶ → 結果。 */
  async function countSheep(): Promise<void> {
    if (playing) return;
    const owner = ctx.getState();
    const session = sheepGame.start(owner);
    if (!session) return;
    playing = true;
    ctx.render();
    await ctx.save();
    const presses = await playSheep(session, (hit) => sound.play(hit ? 'sheepJump' : 'denied'));
    playing = false;
    // 遊んでいるあいだにインポートやリセットで状態が入れ替わっていたら何もしない
    const state = ctx.getState();
    if (state !== owner) return;
    const reward = sheepGame.onFinish(state, session, presses);
    const { result } = reward;
    if (result.counted === 0 && result.blackCounted >= HIDDEN_RULES.miscountBlack) {
      if (unlockEventAchievement(state, 'miscount', Date.now())) ctx.announce(['miscount']);
    }
    ctx.showSheepResult(reward);
    const rewardText =
      reward.factor > 1
        ? t(ja.sheep.resultReward, { s: SHEEP_GAME.buffMs / 1000, f: Math.round(reward.factor * 10) / 10 })
        : ja.sheep.resultNone;
    toaster.show(t(ja.sheepResultToast, { p: reward.points, reward: rewardText }));
    ctx.checkAchievements();
    ctx.render();
    await ctx.save();
  }

  /** 夢くじを引く：券を払ってすぐセーブする（出目はシードで決まっているので、リロードしても変わらない）。 */
  async function drawLottery(): Promise<void> {
    if (!lotteryGame.start(ctx.getState())) {
      sound.play('denied');
      return;
    }
    sound.play('lotterySpin');
    ctx.render();
    await ctx.save();
  }

  function respin(held: readonly boolean[]): void {
    if (!respinLottery(ctx.getState(), held)) {
      sound.play('denied');
      return;
    }
    sound.play('lotterySpin');
    ctx.render();
    void ctx.save();
  }

  function settleLottery(): void {
    const state = ctx.getState();
    const active = state.minigames.lottery.active;
    if (!active) return;
    const prize = lotteryGame.onFinish(state, { seed: active.seed }, active.holds);
    if (!prize) return;
    sound.play(prize.match > 0 ? 'lotteryWin' : 'buy');
    toaster.show(lotteryPrizeText(prize, state.settings.notation), prize.match === 3 ? 'special' : 'info');
    if (prize.match === 3 && prize.symbol === 'coffee' && unlockEventAchievement(state, 'wide_awake', Date.now())) {
      ctx.announce(['wide_awake']);
    }
    ctx.checkAchievements();
    ctx.render();
    void ctx.save();
  }

  function encore(): void {
    const state = ctx.getState();
    if (!buyEncore(state)) {
      sound.play('denied');
      return;
    }
    sound.play('upgrade');
    toaster.show(t(ja.encore.bought, { n: state.prestige.encore }));
    ctx.checkAchievements();
    ctx.render();
    void ctx.save();
  }

  /** めざめ：確認 → 記録してすぐセーブ → エンディング。見たあとは、もう一度エンディングだけ見られる。 */
  async function wake(): Promise<void> {
    const state = ctx.getState();
    const effects = effectsEnabled(state.settings);
    if (state.awakenedAt !== null) {
      await playEnding(effects);
      return;
    }
    const ok = await confirmDialog({
      title: ja.ending.confirmTitle,
      body: [ja.ending.confirmBody],
      confirmLabel: ja.ending.confirmButton,
    });
    if (!ok || ctx.getState() !== state || !awaken(state, Date.now())) return;
    sound.play('awaken');
    ctx.checkAchievements();
    ctx.render();
    await ctx.save();
    await playEnding(effects);
    toaster.show(t(ja.ending.toast, { f: ENDING.productionFactor }), 'special');
  }

  return { countSheep, drawLottery, respinLottery: respin, settleLottery, buyEncore: encore, awaken: wake };
}
