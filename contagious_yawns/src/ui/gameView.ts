import type { ProducerId } from '../data/producers';
import type { BuyAmount, GameState } from '../state/gameState';
import { visibleUpgrades } from '../systems/upgrades';
import { createAchievementsPage } from './achievementsPage';
import { challengesUnlocked } from '../systems/challenges';
import { hibernationUnlocked } from '../systems/hibernation';
import { sheepUnlocked } from '../systems/pillows';
import { dreamUnlocked } from '../systems/prestige';
import { createClickPanel } from './clickPanel';
import { createDreamPage } from './dreamPage';
import { el } from './dom';
import { createProducerList } from './producerList';
import { createChallengesPage } from './challengesPage';
import { createHibernationPage } from './hibernationPage';
import { createSheepPage, type SheepPage } from './sheepPage';
import { createLotteryPage } from './lotteryPage';
import { createStarLayer } from './starLayer';
import { createStatsPage } from './statsPage';
import { createHelpPage } from './helpPage';
import { createAboutPage, createFooter } from './aboutPage';
import { createShareBar } from './shareFlows';
import { createTabBar, type TabId } from './tabs';
import { createTopBar } from './topBar';
import { createUpgradePanel } from './upgradePanel';

export interface GameViewHandlers {
  onClick(): void;
  onBuyProducer(id: ProducerId): void;
  onBuyAmount(amount: BuyAmount): void;
  onBuyUpgrade(id: string): void;
  onSave(): void;
  onSettings(): void;
  onCatchStar(): void;
  onPrestige(): void;
  onBuyNode(id: string): void;
  onToggleAutoBuy(): void;
  onToggleAutoUpgrade(): void;
  onStartSheep(): void;
  onDrawLottery(): void;
  onRespinLottery(held: readonly boolean[]): void;
  onSettleLottery(): void;
  onBuyEncore(): void;
  onAwaken(): void;
  onHibernate(): void;
  onBuyWarmthItem(id: string): void;
  onStartChallenge(id: string): void;
  onAbandonChallenge(): void;
  onToggleAutoPrestige(): void;
  onAutoPrestigeRatio(ratio: number): void;
  /** 手持ちの単位が増えた（演出・効果音用） */
  onDigitUp(): void;
  /** 流れ星が出た（効果音用） */
  onStarAppear(): void;
  /** 共有：𝕏 の投稿画面・端末の共有・画像の保存 */
  onPost(): void;
  onShare(): void;
  onSaveImage(): void;
}

export interface GameView {
  render(state: GameState): void;
  /** 羊を数えた結果をひつじ牧場に出す */
  showSheepResult: SheepPage['showResult'];
  /** クリックで得た量を浮かび上がらせる */
  showGain: ReturnType<typeof createClickPanel>['showGain'];
}

/** 画面全体の組み立て。どのタブを開いているかは見た目だけの状態なので、セーブしない。 */
export function createGameView(root: HTMLElement, handlers: GameViewHandlers, getState: () => GameState): GameView {
  const topBar = createTopBar({ onSave: handlers.onSave, onSettings: handlers.onSettings });
  const clickPanel = createClickPanel(handlers.onClick, handlers.onDigitUp);
  const producerList = createProducerList({
    onBuy: handlers.onBuyProducer,
    onBuyAmount: handlers.onBuyAmount,
    onToggleAuto: handlers.onToggleAutoBuy,
  });
  const upgradePanel = createUpgradePanel(handlers.onBuyUpgrade, handlers.onToggleAutoUpgrade);
  const dreamPage = createDreamPage({
    onPrestige: handlers.onPrestige,
    onBuyNode: handlers.onBuyNode,
    onBuyEncore: handlers.onBuyEncore,
    onToggleAuto: handlers.onToggleAutoPrestige,
    onAutoRatio: handlers.onAutoPrestigeRatio,
  });
  const challengesPage = createChallengesPage({ onStart: handlers.onStartChallenge, onAbandon: handlers.onAbandonChallenge });
  const sheepPage = createSheepPage(handlers.onStartSheep);
  const lotteryPage = createLotteryPage({
    onDraw: handlers.onDrawLottery,
    onRespin: handlers.onRespinLottery,
    onSettle: handlers.onSettleLottery,
  });
  sheepPage.root.append(lotteryPage.root);
  const hibernationPage = createHibernationPage({
    onHibernate: handlers.onHibernate,
    onBuyItem: handlers.onBuyWarmthItem,
    onAwaken: handlers.onAwaken,
  });
  const achievementsPage = createAchievementsPage();
  const statsPage = createStatsPage();
  const helpPage = createHelpPage();
  const aboutPage = createAboutPage(() => select('producers'));
  clickPanel.root.append(createShareBar({ onPost: handlers.onPost, onShare: handlers.onShare, onSaveImage: handlers.onSaveImage }));
  const starLayer = createStarLayer(handlers.onCatchStar, handlers.onStarAppear);

  let active: TabId = 'producers';
  function select(id: TabId): void {
    active = id;
    render(getState());
    window.scrollTo({ top: 0 });
  }
  const tabBar = createTabBar(select);

  const layout = el('main', 'layout');
  layout.append(
    clickPanel.root,
    upgradePanel.root,
    producerList.root,
    dreamPage.root,
    hibernationPage.root,
    challengesPage.root,
    sheepPage.root,
    achievementsPage.root,
    statsPage.root,
    helpPage.root,
    aboutPage.root,
  );
  root.replaceChildren(topBar.root, tabBar.root, layout, createFooter(() => select('about')), starLayer.root);

  function render(state: GameState): void {
    const hasAchievements = state.achievements.size > 0;
    const visible: Record<TabId, boolean> = {
      producers: true,
      upgrades: state.upgrades.size > 0 || visibleUpgrades(state).length > 0,
      dream: dreamUnlocked(state),
      hibernate: hibernationUnlocked(state),
      challenges: challengesUnlocked(state),
      sheep: sheepUnlocked(state),
      achievements: hasAchievements,
      stats: hasAchievements,
      help: true,
      about: true,
    };
    if (!visible[active]) active = 'producers';
    layout.dataset.view = active;
    tabBar.render(visible, active);

    topBar.render(state);
    clickPanel.render(state);
    starLayer.render(state);
    // 見えていないページは描画しない（DOM 更新を減らす）
    if (active === 'achievements') achievementsPage.render(state);
    else if (active === 'stats') statsPage.render(state);
    else if (active === 'help') helpPage.render(state);
    else if (active === 'dream') dreamPage.render(state);
    else if (active === 'sheep') {
      sheepPage.render(state);
      lotteryPage.render(state);
    }
    else if (active === 'hibernate') hibernationPage.render(state);
    else if (active === 'challenges') challengesPage.render(state);
    else {
      upgradePanel.render(state);
      producerList.render(state);
    }
  }

  return { render, showGain: clickPanel.showGain, showSheepResult: sheepPage.showResult };
}
