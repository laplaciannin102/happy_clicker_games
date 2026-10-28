/**
 * 制作者とクレジット（ページ下のクレジット・制作者のページ・共有の文）。
 * 名前とリンクはここだけを直せば、すべての場所に反映される。
 */
export const CREDITS = {
  /** 制作者の名前（仮：リポジトリの持ち主の GitHub 名） */
  creator: 'laplaciannin102',
  year: 2026,
  /** 制作者のリンク。空なら出さない。SNS を足すときはここに並べる */
  links: [{ label: 'GitHub', url: 'https://github.com/laplaciannin102' }] as readonly { label: string; url: string }[],
  /** 共有の文につけるハッシュタグ（# なし） */
  hashtag: 'あくびうつった',
} as const;
