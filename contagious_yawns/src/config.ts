/** セーブ文字列の先頭に付くゲームID（SPEC §6.2） */
export const GAME_ID = 'akubi';

/**
 * localStorage のキー接頭辞。フォルダ名から生成せず固定する（SPEC §2.1）。
 * フォルダ名が変わってもセーブが引き継がれ、相手チームのセーブとも衝突しない。
 */
export const STORAGE_PREFIX = 'claude_';

export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${GAME_ID}_${name}`;
}
