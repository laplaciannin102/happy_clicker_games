import { expect, it } from 'vitest';
import { createSaveActions, saveFilename } from '../src/save/actions';
import { openSave } from '../src/save/storage';
import { encode } from '../src/save/codec';
import { createState } from '../src/state/game';
import { whisper } from '../src/systems/economy';
import { SAVE_KEY } from '../src/config';
import { ja } from '../src/i18n/ja';

async function fixture(answers: boolean[] = []) {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); } };
  const session = await openSave(storage, Date.now());
  whisper(session.state); await session.save(session.state);
  const prompts: string[] = [], messages: string[] = [];
  let changes = 0;
  const actions = createSaveActions(session, {
    synchronize() {}, changed() { changes++; }, notify(text) { messages.push(text); },
    confirm(text) { prompts.push(text); return answers.shift() ?? false; },
  });
  return { data, storage, session, actions, prompts, messages, get changes() { return changes; } };
}

it('壊れたインポートは確認前に拒否し、現在のメモリと保存を保持する', async () => {
  const f = await fixture([true]);
  const before = f.data.get(SAVE_KEY);
  await f.actions.importText('broken');
  expect(f.data.get(SAVE_KEY)).toBe(before);
  expect(f.session.state.clicks).toBe(1);
  expect(f.prompts).toHaveLength(0);
  expect(f.messages.at(-1)).toBe(ja.invalidSave);
});

it('インポートのキャンセルは書き換えない', async () => {
  const f = await fixture([false]);
  const before = f.data.get(SAVE_KEY);
  await f.actions.importText(await encode(createState(Date.now())));
  expect(f.prompts).toEqual([ja.importConfirm]);
  expect(f.data.get(SAVE_KEY)).toBe(before);
  expect(f.changes).toBe(0);
});

it('確認済みの署名不一致インポートへ改造印を付け、再出力でも保持する', async () => {
  const f = await fixture([true]);
  const raw = (await encode(createState(Date.now()))).split('|');
  raw[3] = (raw[3][0] === 'A' ? 'B' : 'A') + raw[3].slice(1);
  await f.actions.importText(raw.join('|'));
  expect(f.prompts).toEqual([ja.taintedConfirm]);
  expect(f.session.state.tainted).toBe(true);
  expect(f.changes).toBe(1);
  expect(await f.actions.exportText()).toMatch(/^rumor\|v8\|/);
});

it.each([{ answers: [false] }, { answers: [true, false] }])('リセット確認のどちらで中断しても進行を維持する (%#)', async ({ answers }) => {
  const f = await fixture([...answers]);
  const before = f.data.get(SAVE_KEY);
  await f.actions.reset();
  expect(f.data.get(SAVE_KEY)).toBe(before);
  expect(f.session.state.clicks).toBe(1);
  expect(f.changes).toBe(0);
});

it('二重確認後のリセットは初期状態を書き込み、バックアップも削除する', async () => {
  const f = await fixture([true, true]);
  whisper(f.session.state); await f.session.save(f.session.state);
  expect((await f.session.backups()).length).toBe(1);
  await f.actions.reset();
  expect(f.prompts).toEqual([ja.resetFirst, ja.resetSecond]);
  expect(f.session.state.clicks).toBe(0);
  expect((await f.session.backups()).length).toBe(0);
  expect((await openSave(f.storage, Date.now())).state.clicks).toBe(0);
});

it('指定のバックアップを確認後に復元し、元の本体をバックアップへ残す', async () => {
  const f = await fixture([true]);
  whisper(f.session.state); await f.session.save(f.session.state);
  expect(f.session.state.clicks).toBe(2);
  await f.actions.restore(0);
  expect(f.prompts).toHaveLength(1);
  expect(f.session.state.clicks).toBe(1);
  expect((await f.session.backups())[0].state.clicks).toBe(2);
});

it('保存ファイル名はゲームIDとローカル日時を含む', () => {
  expect(saveFilename(new Date(2026, 9, 28, 7, 5))).toBe('rumor_save_20261028_0705.txt');
});
