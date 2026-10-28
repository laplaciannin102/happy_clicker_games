/** 文字列をクリップボードへ。使えない環境では選択してから execCommand に頼る。 */
export async function copyText(text: string, field: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    field.focus();
    field.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

/** テキストファイルとしてダウンロードさせる。 */
export function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
