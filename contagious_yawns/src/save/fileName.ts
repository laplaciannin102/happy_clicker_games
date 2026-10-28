import { GAME_ID } from '../config';

const pad = (n: number): string => String(n).padStart(2, '0');

/** エクスポートのファイル名：<ゲームID>_save_YYYYMMDD_HHmm.txt（ローカル時刻、SPEC §6.1） */
export function exportFileName(date: Date): string {
  const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const hm = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${GAME_ID}_save_${ymd}_${hm}.txt`;
}
