import './styles/theme.css';
import './style.css';
import './styles/producers.css';
import './styles/dialog.css';
import './styles/upgrades.css';
import './styles/pages.css';
import './styles/stars.css';
import './styles/dream.css';
import './styles/sheep.css';
import './styles/hibernation.css';
import './styles/lottery.css';
import './styles/effects.css';
import { startLoop } from './core/loop';
import { createSeed } from './core/rng';
import { ACHIEVEMENT_BY_ID } from './data/achievements';
import { DREAM_NODE_BY_ID } from './data/prestige';
import { OFFLINE, TIMING } from './data/economy';
import { ja, t } from './i18n/ja';
import {
  clearAllSaves,
  loadFromStorage,
  quarantineBrokenSave,
  saveToStorage,
  type KeyValueStore,
} from './save/storage';
import { AUTO_PRESTIGE_RATIOS, createInitialState, type GameState } from './state/gameState';
import { checkAchievements, unlockEventAchievement } from './systems/achievements';
import { createPlayFlows } from './ui/playFlows';
import { createLayerFlows } from './ui/layerFlows';
import { createShareFlows } from './ui/shareFlows';
import { createActivityTracker } from './systems/activity';
import { tickBuffs } from './systems/buffs';
import { performClick } from './systems/click';
import { applyOffline, offlineCapMs, offlineEfficiency, type OfflineResult } from './systems/offline';
import { produce } from './systems/production';
import { createAutomation } from './systems/automation';
import { abandonChallenge, activeChallenge } from './systems/challenges';
import { buyWarmthItem } from './systems/hibernation';
import { tickPillows } from './systems/pillows';
import { buyNode } from './systems/dreamTree';
import { catchStar, tickStars } from './systems/stars';
import { buyProducer } from './systems/purchase';
import { buyUpgrade } from './systems/upgrades';
import { achievementText } from './ui/achievementText';
import { createGameView } from './ui/gameView';
import { dreamNodeName } from './ui/dreamText';
import { challengeName } from './ui/challengesPage';
import { createSettingsFlows } from './ui/settingsFlows';
import { starCaughtText } from './ui/starText';
import { createToaster } from './ui/toast';
import { showWelcomeBack } from './ui/welcomeBack';
import { upgradeNameById } from './ui/upgradePanel';
import { applyAppearance } from './ui/appearance';
import { createSoundPlayer } from './ui/sound';

/** 実績の解除を確かめる間隔 */
const ACHIEVEMENT_CHECK_MS = 500;
/** 一度にこれより多く解除されたら、通知を1件にまとめる */
const MAX_ACHIEVEMENT_TOASTS = 2;

function getStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function boot(root: HTMLElement): Promise<void> {
  document.title = ja.title;
  const storage = getStorage();
  const toaster = createToaster();
  document.body.append(toaster.root);

  let state: GameState = createInitialState(Date.now(), createSeed());
  let offlineOnLoad: OfflineResult | null = null;
  // セーブがこのページより新しい版なら、上書きしないよう保存を止める
  let savingBlocked = false;
  if (storage) {
    const load = await loadFromStorage(storage, Date.now());
    if (load.newerVersion) {
      savingBlocked = true;
      toaster.show(ja.newerSave, 'warn');
    }
    if (load.brokenMain !== null) quarantineBrokenSave(storage, load.brokenMain);
    if (load.loaded) {
      state = load.loaded.state;
      // 羊を数えている途中でページを閉じた回は無効（費用は払い済み）
      state.minigames.active = null;
      offlineOnLoad = applyOffline(state, Date.now() - state.lastSavedAt);
      if (typeof load.source === 'number') toaster.show(t(ja.loadFromBackup, { n: load.source }), 'warn');
      if (load.loaded.signature === 'invalid' || load.loaded.issues.length > 0) {
        toaster.show(ja.loadTainted, 'warn');
      }
    } else if (load.brokenMain !== null) {
      toaster.show(ja.loadBroken, 'warn');
    }
  } else {
    toaster.show(ja.storageUnavailable, 'warn');
  }

  // セーブは署名が非同期なので、順番が入れ替わらないよう1本の列に並べる
  let queue: Promise<boolean> = Promise.resolve(true);
  const enqueue = (task: () => Promise<boolean>): Promise<boolean> => {
    queue = queue.then(task, task);
    return queue;
  };
  const save = (): Promise<boolean> => {
    if (!storage || savingBlocked) return Promise.resolve(false);
    const snapshot = state;
    return enqueue(() => saveToStorage(snapshot, storage, Date.now()));
  };

  const sound = createSoundPlayer(state.settings.volume);
  let autosaveTimer = 0;
  /** 設定（テーマ・演出・音量・自動セーブ間隔）を画面に反映する。読み込み・リセットのあとにも呼ぶ */
  function applySettings(): void {
    applyAppearance(state.settings);
    sound.setVolume(state.settings.volume);
    window.clearInterval(autosaveTimer);
    autosaveTimer = window.setInterval(() => void save(), state.settings.autosaveSec * 1000);
  }
  applySettings();

  const activity = createActivityTracker(performance.now());
  const markInput = (): void => activity.input(performance.now());

  // クリックの受付間隔（押しっぱなし・連打ツール対策）
  const minClickGapMs = 1000 / TIMING.maxClicksPerSec;
  let lastClickAt = -Infinity;

  const view = createGameView(
    root,
    {
      onClick() {
        const now = performance.now();
        if (now - lastClickAt < minClickGapMs) return;
        lastClickAt = now;
        activity.click(now);
        const gained = performClick(state);
        if (gained.gt(0)) sound.play('click');
        view.showGain(state, gained);
        render();
      },
      onBuyProducer(id) {
        if (buyProducer(state, id, state.settings.buyAmount) > 0) {
          sound.play('buy');
          render();
        } else sound.play('denied');
      },
      onBuyAmount(amount) {
        state.settings.buyAmount = amount;
        render();
      },
      onBuyUpgrade(id) {
        if (!buyUpgrade(state, id)) {
          sound.play('denied');
          return;
        }
        sound.play('upgrade');
        toaster.show(t(ja.upgradeBought, { name: upgradeNameById(id) }));
        render();
      },
      onSave() {
        void save().then((ok) => {
          if (ok) toaster.show(ja.saved);
          else toaster.show(storage ? ja.saveFailed : ja.storageUnavailable, 'warn');
        });
      },
      onSettings() {
        settings.open(state);
      },
      onCatchStar() {
        const result = catchStar(state);
        if (!result) return;
        markInput();
        sound.play('starCatch');
        toaster.show(starCaughtText(result, state.settings.notation));
        render();
      },
      onPrestige() {
        void layers.prestige();
      },
      onBuyNode(id) {
        if (!buyNode(state, id)) return;
        sound.play('upgrade');
        const def = DREAM_NODE_BY_ID.get(id);
        if (def) toaster.show(t(ja.dream.nodeBought, { name: dreamNodeName(def) }));
        render();
        void save();
      },
      onToggleAutoBuy() {
        state.settings.autoBuy = !state.settings.autoBuy;
        render();
      },
      onToggleAutoUpgrade() {
        state.settings.autoUpgrade = !state.settings.autoUpgrade;
        render();
      },
      onStartSheep() {
        void play.countSheep();
      },
      onDrawLottery() {
        void play.drawLottery();
      },
      onRespinLottery(held) {
        play.respinLottery(held);
      },
      onSettleLottery() {
        play.settleLottery();
      },
      onBuyEncore() {
        play.buyEncore();
      },
      onAwaken() {
        void play.awaken();
      },
      onHibernate() {
        void layers.hibernate();
      },
      onStartChallenge(id) {
        void layers.beginChallenge(id);
      },
      onAbandonChallenge() {
        const c = activeChallenge(state);
        if (!c) return;
        abandonChallenge(state);
        toaster.show(t(ja.challenge.abandoned, { name: challengeName(c) }));
        render();
      },
      onToggleAutoPrestige() {
        state.settings.autoPrestige.enabled = !state.settings.autoPrestige.enabled;
        render();
      },
      onAutoPrestigeRatio(ratio) {
        const r = AUTO_PRESTIGE_RATIOS.find((x) => x === ratio);
        if (r !== undefined) state.settings.autoPrestige.ratio = r;
        render();
      },
      onDigitUp() {
        sound.play('digitUp');
      },
      onStarAppear() {
        sound.play('starAppear');
      },
      onPost() {
        share.post();
      },
      onShare() {
        void share.share();
      },
      onSaveImage() {
        void share.saveImage();
      },
      onBuyWarmthItem(id) {
        if (!buyWarmthItem(state, id)) return;
        sound.play('upgrade');
        toaster.show(t(ja.hibernation.bought, { name: ja.hibernation.items[id] ?? id }));
        render();
        void save();
      },
    },
    () => state,
  );

  const settings = createSettingsFlows({
    getState: () => state,
    setState(next) {
      state = next;
      applySettings();
      render();
    },
    render,
    save,
    async resetStorage(fresh) {
      if (!storage) return;
      await enqueue(() => {
        clearAllSaves(storage);
        return saveToStorage(fresh, storage, Date.now());
      });
    },
    applySettings,
    toaster,
    sound,
  });

  const share = createShareFlows({ getState: () => state, toaster });

  const play = createPlayFlows({
    getState: () => state,
    render,
    save,
    sound,
    toaster,
    showSheepResult: (reward) => view.showSheepResult(reward),
    announce: announceAchievements,
    checkAchievements: checkAllAchievements,
  });

  function render(): void {
    view.render(state);
  }

  const layers = createLayerFlows({
    getState: () => state,
    render,
    save,
    sound,
    toaster,
    checkAchievements: checkAllAchievements,
    onPrestiged: () => activity.prestiged(performance.now()),
  });

  const automation = createAutomation();

  function announceAchievements(ids: readonly string[]): void {
    if (ids.length > 0) sound.play('achievement');
    // 古いセーブの移行などでまとめて解除されたときは、1件にまとめる
    if (ids.length > MAX_ACHIEVEMENT_TOASTS) {
      toaster.show(t(ja.achievementsUnlockedMany, { n: ids.length }), 'special');
      return;
    }
    for (const id of ids) {
      const def = ACHIEVEMENT_BY_ID.get(id);
      if (!def) continue;
      toaster.show(t(ja.achievementUnlocked, { name: achievementText(def, state.settings.notation).name }), 'special');
    }
  }

  function checkAllAchievements(): void {
    const now = Date.now();
    const visible = document.visibilityState === 'visible';
    const events = activity
      .poll(performance.now(), visible, new Date(now).getHours())
      .filter((id) => unlockEventAchievement(state, id, now));
    const unlocked = [...checkAchievements(state, now), ...events];
    if (unlocked.length > 0) {
      announceAchievements(unlocked);
      render();
    }
  }

  function welcomeBack(result: OfflineResult): void {
    if (result.awayMs < OFFLINE.noticeMinMs || result.gained.lte(0)) return;
    void showWelcomeBack(
      result,
      { capMs: offlineCapMs(state), efficiency: offlineEfficiency(state) },
      state.settings.notation,
    );
  }

  const isVisible = (): boolean => document.visibilityState === 'visible';

  startLoop({
    update: (dt) => {
      produce(state, dt);
      tickBuffs(state, dt * 1000);
      tickStars(state, dt * 1000, isVisible());
      tickPillows(state, dt * 1000);
      automation.tick(state, dt * 1000);
    },
    catchUp: (elapsed) => {
      const ms = elapsed * 1000;
      activity.away(ms);
      // 長く止まっていた（PC のスリープなど）ならオフライン扱い。短い停止はふつうに進める
      if (ms >= OFFLINE.pausedThresholdMs) {
        welcomeBack(applyOffline(state, ms));
      } else {
        produce(state, elapsed);
        tickBuffs(state, ms);
        tickStars(state, ms, isVisible());
        tickPillows(state, ms);
      }
    },
    render,
  });
  render();

  if (offlineOnLoad) {
    activity.away(offlineOnLoad.awayMs);
    welcomeBack(offlineOnLoad);
  }

  window.addEventListener('pointerdown', markInput, { passive: true });
  window.addEventListener('keydown', markInput);
  window.setInterval(() => {
    layers.checkChallengesAndAuto();
    checkAllAchievements();
  }, ACHIEVEMENT_CHECK_MS);

  // 読み込んだ直後に最新の形式で保存し直す（旧形式からの移行もここで済む）
  void save();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void save();
    // 画面に戻ってきたら「寝落ち」の計測をやり直す（開いたまま、が条件）
    else markInput();
  });
  // 署名が非同期なので、閉じる瞬間のセーブは間に合わないことがある（最大でも自動セーブ1回分）
  window.addEventListener('pagehide', () => void save());
  window.addEventListener('beforeunload', () => void save());
}

const root = document.getElementById('app');
if (root) void boot(root);
