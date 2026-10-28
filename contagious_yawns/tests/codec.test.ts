import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { base64UrlToUtf8, utf8ToBase64Url } from '../src/save/base64url';
import { decodeSave, encodeSave } from '../src/save/codec';
import { exportFileName } from '../src/save/fileName';
import { migrate } from '../src/save/migrations';
import { sign, verify } from '../src/save/signing';
import { SCHEMA_VERSION } from '../src/state/gameState';
import { playedState } from './helpers';

const strict = { allowLegacyJson: false };

/** 本体を書き換えて、署名はそのまま残す（Base64 をデコードして数字を書き換える改造） */
function tamperBody(text: string, edit: (payload: Record<string, unknown>) => void): string {
  const [game, version, body, signature] = text.split('|') as [string, string, string, string];
  const payload = JSON.parse(base64UrlToUtf8(body) ?? '{}') as Record<string, unknown>;
  edit(payload);
  return [game, version, utf8ToBase64Url(JSON.stringify(payload)), signature].join('|');
}

describe('Base64URL', () => {
  it('UTF-8 の往復', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'あくび、うつった。', '{"x":"1e400"}']) {
      expect(base64UrlToUtf8(utf8ToBase64Url(s))).toBe(s);
    }
  });

  it('URL で安全な文字だけを使い、パディングしない', () => {
    expect(utf8ToBase64Url('ÿþý?>')).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('壊れた入力は null', () => {
    expect(base64UrlToUtf8('a')).toBeNull();
    expect(base64UrlToUtf8('ab+c')).toBeNull();
    expect(base64UrlToUtf8('__8')).toBeNull(); // 不正な UTF-8
  });
});

describe('署名', () => {
  it('16バイト（Base64URL で22文字）', async () => {
    expect(await sign('hello')).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('同じ入力なら同じ署名、1文字でも違えば検証に失敗', async () => {
    const sig = await sign('akubi|v2|abc');
    expect(await verify('akubi|v2|abc', sig)).toBe(true);
    expect(await verify('akubi|v2|abd', sig)).toBe(false);
    expect(await verify('akubi|v2|abc', `${sig.slice(0, -1)}A`)).toBe(sig.endsWith('A'));
  });
});

describe('セーブ形式', () => {
  it('<ゲームID>|v<版>|<本体>|<署名> の形', async () => {
    const text = await encodeSave(playedState());
    expect(text).toMatch(new RegExp(`^akubi\\|v${SCHEMA_VERSION}\\|[A-Za-z0-9_-]+\\|[A-Za-z0-9_-]{22}$`));
  });

  it('往復変換で同じ状態に戻る（1e308 を超える数も）', async () => {
    const s = playedState();
    s.yawns = new Decimal('1.5e400');
    s.totalYawns = new Decimal('ee20');
    const result = await decodeSave(await encodeSave(s), strict);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const back = result.value.state;
    expect(result.value.signature).toBe('valid');
    expect(back.yawns.eq(s.yawns)).toBe(true);
    expect(back.totalYawns.eq(s.totalYawns)).toBe(true);
    expect(back.producers).toEqual(s.producers);
    expect(back.settings).toEqual(s.settings);
    expect(back.rngSeed).toBe(s.rngSeed);
    expect(back.tainted).toBe(false);
  });

  it('前後の空白や改行は無視する', async () => {
    const text = await encodeSave(playedState());
    expect((await decodeSave(`\n  ${text}  \n`, strict)).ok).toBe(true);
  });

  it('本体の書き換えは署名で検出される（読み込みはできる）', async () => {
    const text = tamperBody(await encodeSave(playedState()), (p) => {
      p.yawns = '1e100';
    });
    const result = await decodeSave(text, strict);
    expect(result.ok && result.value.signature).toBe('invalid');
  });

  it('版番号だけ書き換えても署名で検出される', async () => {
    const text = (await encodeSave(playedState())).replace(`|v${SCHEMA_VERSION}|`, '|v1|');
    const result = await decodeSave(text, strict);
    expect(result.ok).toBe(false); // v1 は素の JSON 形式なので、この形では受け付けない
  });

  it.each([
    ['', 'format'],
    ['hello', 'format'],
    ['akubi|v2|abc', 'format'],
    ['akubi|v2|a|b|c', 'format'],
    ['other|v2|abc|def', 'otherGame'],
    ['akubi|v999|abc|def', 'newerVersion'],
    ['akubi|vX|abc|def', 'format'],
    ['akubi|v2|!!!|def', 'body'],
    [`akubi|v2|${utf8ToBase64Url('not json')}|def`, 'body'],
    [`akubi|v2|${utf8ToBase64Url('{"yawns":"1"}')}|def`, 'body'],
  ])('壊れた入力 %j は %s で拒否', async (text, error) => {
    const result = await decodeSave(text, strict);
    expect(result).toEqual({ ok: false, error });
  });

  it('値がおかしい本体は拒否（部分的に読まない）', async () => {
    const base = await encodeSave(playedState());
    const edits: ((p: Record<string, unknown>) => void)[] = [
      (p) => (p.yawns = 'abc'),
      (p) => (p.yawns = '-5'),
      (p) => (p.yawns = 'Infinity'),
      (p) => (p.clicks = 1.5),
      (p) => (p.tainted = 'no'),
      (p) => (p.producers = { cat: { bought: -1 } }),
      (p) => (p.settings = { notation: 'roman', buyAmount: 1 }),
    ];
    for (const edit of edits) {
      expect((await decodeSave(tamperBody(base, edit), strict)).ok).toBe(false);
    }
  });
});

describe('マイグレーション', () => {
  /** Phase 1 が localStorage に書いていた形 */
  const legacy = {
    v: 1,
    yawns: '12',
    totalYawns: '89.5',
    clicks: 80,
    producers: { cat: { bought: 2 }, lecture: { bought: 0 }, meeting: { bought: 0 } },
    rngSeed: 7,
    playTimeMs: 60_000,
    createdAt: 1_700_000_000_000,
    lastSavedAt: 1_700_000_060_000,
    settings: { notation: 'ja', buyAmount: 1 },
  };

  it('v1 → 最新 で tainted・upgrades・実績・全期間の記録が足される', () => {
    expect(migrate(legacy, 1)).toMatchObject({
      tainted: false,
      upgrades: [],
      achievements: {},
      lifetime: { yawns: '89.5', clicks: 80, playTimeMs: 60_000 },
      yawns: '12',
    });
    expect(migrate(legacy, 1)).not.toHaveProperty('v');
  });

  it('v5 → v6：おやすみと自動化の設定が足される', () => {
    const v5 = { ...migrate(legacy, 1) };
    const out = migrate({ ...v5, prestige: undefined, settings: { notation: 'ja', buyAmount: 1 } }, 5);
    expect(out).toMatchObject({
      prestige: { shards: 0, shardsLifetime: 0, count: 0, nodes: [] },
      settings: { notation: 'ja', buyAmount: 1, autoBuy: true, autoUpgrade: true },
    });
  });

  it('v4 → v5：流れ星と一時的な倍率が足される', () => {
    const v4 = { ...migrate(legacy, 1) };
    const out = migrate({ ...v4, stars: undefined, buffs: undefined }, 4);
    expect(out).toMatchObject({ buffs: [], stars: { active: null, clicked: 0 }, lifetime: { stars: 0, clicks: 80 } });
  });

  it('v3 → v4：全期間の記録は今回の周回から作る', () => {
    const { v: _v, ...v3 } = { ...legacy, tainted: false, upgrades: ['cat_t1'] };
    expect(migrate(v3, 3)).toMatchObject({ upgrades: ['cat_t1'], lifetime: { clicks: 80 } });
  });

  it('実績と全期間の記録は往復で保たれ、知らない実績は読み飛ばす', async () => {
    const s = playedState();
    const text = tamperBody(await encodeSave(s), (p) => {
      p.achievements = { yawns_1: 123, removed_achievement: 456 };
    });
    const result = await decodeSave(text, strict);
    expect(result.ok && [...result.value.state.achievements]).toEqual([['yawns_1', 123]]);
    const clean = await decodeSave(await encodeSave(s), strict);
    expect(clean.ok && clean.value.state.lifetime.clicks).toBe(s.lifetime.clicks);
    expect(clean.ok && clean.value.state.lifetime.yawns.eq(s.lifetime.yawns)).toBe(true);
  });

  it('v2 → v3 で upgrades が足される', () => {
    const { v: _v, ...v2 } = { ...legacy, tainted: true };
    expect(migrate(v2, 2)).toMatchObject({ tainted: true, upgrades: [] });
  });

  it('アップグレードは往復で保たれ、知らない ID は読み飛ばす', async () => {
    const s = playedState();
    s.upgrades.add('cat_t1');
    s.upgrades.add('click_1');
    const text = tamperBody(await encodeSave(s), (p) => {
      p.upgrades = ['cat_t1', 'click_1', 'removed_upgrade'];
    });
    const result = await decodeSave(text, strict);
    expect(result.ok && [...result.value.state.upgrades].sort()).toEqual(['cat_t1', 'click_1']);
    const clean = await decodeSave(await encodeSave(s), strict);
    expect(clean.ok && clean.value.signature).toBe('valid');
  });

  it('Phase 1 の JSON セーブは localStorage からなら読める', async () => {
    const result = await decodeSave(JSON.stringify(legacy), { allowLegacyJson: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.signature).toBe('legacy');
    expect(result.value.fromVersion).toBe(1);
    expect(result.value.state.producers.cat.bought).toBe(2);
  });

  it('署名のない JSON はインポートでは受け付けない', async () => {
    expect(await decodeSave(JSON.stringify(legacy), strict)).toEqual({ ok: false, error: 'format' });
  });

  it('知らない版・未来の版は変換できない', () => {
    expect(migrate({}, 0)).toBeNull();
    expect(migrate({}, SCHEMA_VERSION + 1)).toBeNull();
  });
});

describe('ファイル名', () => {
  it('akubi_save_YYYYMMDD_HHmm.txt', () => {
    expect(exportFileName(new Date(2026, 9, 28, 7, 5))).toBe('akubi_save_20261028_0705.txt');
  });
});
