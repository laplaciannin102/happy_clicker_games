import { GAME_ID } from '../config';
import { catchUp } from '../core/time';
import { ja } from '../i18n/ja';
import { createState } from '../state/game';
import { decode, encode } from './codec';
import type { SaveSession } from './storage';
import { createPrestigeState, prestigeReward } from '../systems/prestige';
import { formatNumber } from '../ui/format';
import { parseState } from './state-format';
import { serialize } from './codec';
import { continueTale, bankTale } from '../minigames/tale/game';
import { minigames } from '../minigames';
import type { TaleChoice } from '../minigames/tale/state';
import { shouldAutoPrestige } from '../systems/automation';
import { canCompileMyth, compileMyth, canStartChallenge, startChallenge, leaveChallenge } from '../systems/myth';
import { mythBalance, type ChallengeId } from '../data/myth';
import type { GameState } from '../state/game';
import { answerMail } from '../minigames/mail/game';
import { readEpilogue } from '../systems/chronicle';

export interface ActionHooks {
  synchronize(): void | Promise<void>;
  catchUp?(state: GameState, now: number): Promise<unknown>;
  changed(): void;
  notify(text: string): void;
  confirm(text: string): boolean | Promise<boolean>;
}

export function saveFilename(date = new Date()): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${GAME_ID}_save_${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}_${two(date.getHours())}${two(date.getMinutes())}.txt`;
}

export function createSaveActions(session: SaveSession, hooks: ActionHooks) {
  let busy = false;
  async function exclusive(work: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try { await work(); } catch { hooks.notify(ja.importFailed); }
    finally { busy = false; }
  }
  async function apply(next: Awaited<ReturnType<typeof decode>>, reset = false, message: string = ja.imported) {
    const result = await session.replace(next, reset);
    if (result === 'saved' || result === 'reset-partial') {
      hooks.changed();
      hooks.notify(reset ? result === 'saved' ? ja.resetDone : ja.resetPartial : message);
    } else hooks.notify(result === 'conflict' ? ja.saveConflict : ja.importFailed);
    return result === 'saved' || result === 'reset-partial';
  }
  async function importText(raw: string) {
    await exclusive(async () => {
      let next;
      try { next = await decode(raw, Date.now(), 'import'); }
      catch { hooks.notify(ja.invalidSave); return; }
      if (!await hooks.confirm(next.tainted ? ja.taintedConfirm : ja.importConfirm)) {
        hooks.notify(ja.cancelled); return;
      }
      if (hooks.catchUp) await hooks.catchUp(next, Date.now()); else catchUp(next, Date.now());
      await apply(next);
    });
  }
  async function restore(slot: number) {
    await exclusive(async () => {
      const backup = (await session.backups()).find(item => item.slot === slot);
      if (!backup) { hooks.notify(ja.noBackup); return; }
      const question = ja.backupConfirm(new Date(backup.state.lastUpdatedAt).toLocaleString('ja-JP'));
      if (!await hooks.confirm(backup.state.tainted ? `${question}\n${ja.taintedConfirm}` : question)) {
        hooks.notify(ja.cancelled); return;
      }
      if (hooks.catchUp) await hooks.catchUp(backup.state, Date.now()); else catchUp(backup.state, Date.now());
      await apply(backup.state);
    });
  }
  async function reset() {
    await exclusive(async () => {
      if (!await hooks.confirm(ja.resetFirst) || !await hooks.confirm(ja.resetSecond)) {
        hooks.notify(ja.cancelled); return;
      }
      await apply(createState(Date.now()), true);
    });
  }
  async function exportText() {
    await hooks.synchronize();
    return encode(session.state);
  }
  async function prestige(automatic = false) {
    await exclusive(async () => {
      await hooks.synchronize();
      const reward = prestigeReward(session.state);
      if (automatic && !shouldAutoPrestige(session.state)) return;
      if (session.state.challenge.active || reward.lt(1)) { hooks.notify(ja.prestigeUnavailable); return; }
      const amount = formatNumber(reward, session.state.format);
      if (!automatic && !await hooks.confirm(ja.prestigeConfirm(amount))) { hooks.notify(ja.cancelled); return; }
      const next = createPrestigeState(session.state, Date.now());
      if (!next) { hooks.notify(ja.prestigeUnavailable); return; }
      const saved = await apply(next, false, ja.prestigeDone(amount));
      if (automatic && !saved) {
        session.state.automation.prestige = false; hooks.changed(); hooks.notify(ja.autoPrestigePaused);
      }
    });
  }
  async function tale(operation: 'start' | 'continue' | 'bank', choice: TaleChoice = 'safe') {
    await exclusive(async () => {
      await hooks.synchronize();
      const next = parseState(JSON.parse(serialize(session.state)) as unknown);
      const changed = operation === 'start' ? minigames[0].start(next, choice)
        : operation === 'continue' ? continueTale(next, choice) : bankTale(next);
      if (!changed) { hooks.notify(ja.taleUnavailable); return; }
      // Persist the fee, ticket, random rolls and chosen path before revealing anything.
      await apply(next, false, operation === 'bank' ? ja.taleBanked : ja.taleStarted);
    });
  }
  async function progression(operation: 'myth' | 'start' | 'abandon' | 'complete', id?: ChallengeId) {
    await exclusive(async () => {
      await hooks.synchronize();
      const s = session.state;
      const available = operation === 'myth' ? canCompileMyth(s) : operation === 'start'
        ? !!id && canStartChallenge(s, id) : !!s.challenge.active && (operation !== 'complete' || s.earned.gte(mythBalance.challengeGoal));
      if (!available) { hooks.notify(ja.progressionUnavailable); return; }
      const question = operation === 'myth' ? ja.mythConfirm : operation === 'start' ? ja.challengeStartConfirm
        : operation === 'complete' ? ja.challengeCompleteConfirm : ja.challengeAbandonConfirm;
      if (!await hooks.confirm(question)) { hooks.notify(ja.cancelled); return; }
      const next = operation === 'myth' ? compileMyth(s, Date.now()) : operation === 'start' && id
        ? startChallenge(s, id, Date.now()) : leaveChallenge(s, Date.now(), operation === 'complete');
      if (next) await apply(next, false, ja.progressionDone);
    });
  }
  async function mail(operation: 'start' | 'answer' | 'read', destination?: number) {
    await exclusive(async () => {
      await hooks.synchronize();
      const next = parseState(JSON.parse(serialize(session.state)) as unknown);
      const changed = operation === 'start' ? minigames[1].start(next) : operation === 'answer'
        ? answerMail(next,destination ?? -1) : readEpilogue(next);
      if (!changed) { hooks.notify(ja.mailUnavailable); return; }
      await apply(next,false,operation === 'read' ? ja.chronicleDone : operation === 'start' ? ja.mailStarted : ja.mailSent);
    });
  }
  return { importText, restore, reset, exportText, prestige, tale, progression, mail, get busy() { return busy; } };
}
export type SaveActions = ReturnType<typeof createSaveActions>;
