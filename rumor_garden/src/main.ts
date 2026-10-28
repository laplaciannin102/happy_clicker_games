import { SNAPSHOT_MS } from './config';
import { balance } from './data/balance';
import { ja } from './i18n/ja';
import { tickTo } from './core/time';
import { catchUpAsync } from './core/offline';
import { openSave } from './save/storage';
import { createSaveActions } from './save/actions';
import { parseState, serialize } from './save/state-format';
import { buy, whisper } from './systems/economy';
import { createView } from './ui/view';
import { createSavePanel } from './ui/save-panel';
import { confirmAction } from './ui/confirm';
import { formatNumber } from './ui/format';
import { buyUpgrade } from './systems/upgrades';
import { collectEvent } from './systems/events';
import { achievements } from './data/achievements';
import { achievementName } from './ui/names';
import { buyPermanentUpgrade } from './systems/prestige';
import { configureAutomation, shouldAutoPrestige } from './systems/automation';
import { parsePreferences } from './state/preferences';
import type { GameState } from './state/game';
import { createAudio, type Sound } from './ui/audio';
import { createOfflinePanel } from './ui/offline-panel';
import './style.css';

async function start(app: HTMLElement) {
  const storage = {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
    removeItem: (key: string) => localStorage.removeItem(key),
  };
  const session = await openSave(storage, Date.now());
  const state = session.state, offlinePanel = createOfflinePanel();
  document.documentElement.dataset.theme = state.preferences.theme === 'system'
    ? matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' : state.preferences.theme;
  const audio = createAudio(() => state.preferences);
  let recovering = false, recoveryTask: Promise<void> | null = null;
  let knownAchievements = new Set(state.achievements), lastNotice = 0;
  async function workOffline(next: GameState, now: number) {
    recovering = true; app.inert = true; app.setAttribute('aria-busy', 'true');
    try { return await catchUpAsync(next, now, { progress: value => offlinePanel.show(value) }); }
    finally { recovering = false; app.inert = false; app.removeAttribute('aria-busy'); offlinePanel.hide(); }
  }
  const offline = await workOffline(state, Date.now());
  const view = createView(app, state, {
    whisper() { void perform(() => { whisper(state); celebrate('click'); }); },
    buy(index) { void perform(() => { if (buy(state, index, state.buyMode)) celebrate('buy', index); }); },
    format(value) { void perform(() => { state.format = value; }); },
    mode(value) { void perform(() => { state.buyMode = value; }); },
    save() { void perform(() => save()); },
    upgrade(id) { void perform(() => { if (buyUpgrade(state, id)) celebrate('research'); }); },
    prestige() { if (!blocked()) void actions.prestige(); },
    permanent(id) { void perform(() => { if (buyPermanentUpgrade(state, id)) celebrate('research'); }); },
    tale(operation, choice) { if (!blocked()) void actions.tale(operation, choice); },
    mail(operation, destination) { if (!blocked()) void actions.mail(operation, destination); },
    progression(operation, id) { if (!blocked()) void actions.progression(operation, id); },
    automation(command) { void perform(() => { if (!configureAutomation(state, command)) notify(ja.automationInvalid); }); },
    preferences(value) {
      if (blocked()) return;
      state.preferences = parsePreferences(value); audio.unlock(); refresh(); audio.play('click');
    },
    event() { void perform(async () => {
      if (collectEvent(state)) { celebrate('event'); refresh(); notify(ja.eventCollected); await save(true); }
    }); },
  });
  const actions = createSaveActions(session, {
    synchronize, catchUp: workOffline,
    changed() { refresh(); celebrate('reset'); }, notify, confirm: confirmAction,
  });
  view.attachSavePanel(createSavePanel(actions, notify));
  function blocked() { return actions.busy || recovering; }
  function celebrate(kind: Sound, index?: number) { view.celebrate(kind, index); audio.play(kind); }
  async function perform(work: () => void | Promise<void>) {
    if (blocked()) return;
    audio.unlock();
    try { await synchronize(); if (actions.busy) return; await work(); refresh(); }
    catch { notify(ja.saveFailed); }
  }
  function notify(text: string) { lastNotice = Date.now(); view.notify(text); }
  function synchronize(forceReport = false): void | Promise<void> {
    if (recoveryTask) return recoveryTask;
    if (Date.now() - state.lastUpdatedAt > balance.catchUpThresholdMs) {
      const next = parseState(JSON.parse(serialize(state)) as unknown);
      recoveryTask = (async () => {
        try {
          await workOffline(next, Date.now()); Object.assign(state, next);
          const award = announceAchievements(); refresh(); notifyOffline(award);
        } finally { recoveryTask = null; }
      })();
      return recoveryTask;
    }
    const wasVisible = state.events.visible > 0;
    const gained = tickTo(state, Date.now()), award = announceAchievements();
    if (!wasVisible && state.events.visible > 0) notify(ja.eventArrived);
    if (gained?.gt(0) && (forceReport || Date.now() - lastNotice > 5000)) notifyOffline(award);
    else if (award) notify(award);
  }
  function announceAchievements() {
    const added = achievements.filter(item => state.achievements.includes(item.id) && !knownAchievements.has(item.id));
    knownAchievements = new Set(state.achievements);
    if (added.length) { view.celebrate('achievement'); audio.play('achievement'); }
    return added.length ? ja.achievementToast(achievementName(added[0]), added.length - 1) : undefined;
  }
  function notifyOffline(award?: string) {
    const report = ja.offlineToast(String(Math.ceil(state.lastOffline.seconds)),
      formatNumber(state.lastOffline.gained, state.format), state.lastOffline.capped);
    notify(award ? `${report}\n${award}` : report);
  }
  function refresh() {
    audio.sync();
    const award = announceAchievements(); if (award) notify(award);
    view.render(); void session.prepare(state).catch(() => notify(ja.saveFailed));
  }
  async function save(quiet = false) {
    const result = await session.save(state);
    if (result === 'obsolete' || (quiet && result === 'saved')) return;
    notify(result === 'saved' ? ja.saved : result === 'conflict' ? ja.saveConflict
      : result === 'blocked' ? ja.saveBlocked : ja.saveFailed);
  }
  view.render(); await session.prepare(state);
  const arrivalAward = announceAchievements();
  notify(session.status === 'blocked' ? ja.saveBlocked : session.status === 'recovered' ? ja.recovered
    : offline.gt(0) ? ja.offlineToast(String(Math.ceil(state.lastOffline.seconds)), formatNumber(offline, state.format), state.lastOffline.capped)
      : session.status === 'loaded' ? ja.loaded : ja.welcome);
  if (arrivalAward && offline.gt(0)) notifyOffline(arrivalAward);

  let lastRender = 0, lastSnapshot = 0, lastAutosave = Date.now();
  function frame(timestamp: number) {
    if (!document.hidden && !blocked()) {
      const pending = synchronize();
      if (pending) { void pending.catch(() => notify(ja.saveFailed)); requestAnimationFrame(frame); return; }
      if (shouldAutoPrestige(state)) { void actions.prestige(true); requestAnimationFrame(frame); return; }
      if (timestamp - lastRender >= balance.renderMs) { view.render(); lastRender = timestamp; }
      if (timestamp - lastSnapshot >= SNAPSHOT_MS) {
        void session.prepare(state).catch(() => notify(ja.saveFailed)); lastSnapshot = timestamp;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setInterval(() => {
    if (!document.hidden && !blocked() && Date.now() - lastAutosave >= state.preferences.autosaveSeconds * 1000) {
      lastAutosave = Date.now(); void perform(() => save(true));
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (blocked()) return;
    const pending = synchronize(!document.hidden);
    if (pending) { void pending.catch(() => notify(ja.saveFailed)); return; }
    if (document.hidden) { session.flush(); void save(true); } else refresh();
  });
  // While recovering, only the previous complete snapshot can be flushed.
  window.addEventListener('beforeunload', () => { session.flush(); });
  window.addEventListener('pagehide', () => { session.flush(); });
}
const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing application mount point');
document.title = ja.title; app.textContent = ja.loading;
void start(app).catch(() => { app.textContent = ja.unavailable; });
