# 画像・効果音（Phase 7）

## ブラウザのアイコン

`public/favicon.svg`は紺地に琥珀色の吹き出しと三つの点を描いた64×64のSVG。小さなタブでも噂話を表す形が読めるよう、細かな装飾を省いた。index.htmlから相対パスで参照し、公開先のフォルダ名に依存しない。追加の画像生成や外部通信は使用しない。

画像12点は内蔵imagegenで生成し、public/assets/へPNG原本を保存。夜の紺・琥珀色、丸い形、紙の質感で統一した。全点を目視確認済み。透明背景を指定した11点はアルファ付き、挿絵は背景付き。表示サイズはクリック対象512×512、生産者128×128を論理サイズとしCSSで縮小する。生成原本は1254×1254pxで、合計約24.4MB。生産者と挿絵は遅延読み込みし、画像が失敗しても文字・記号で操作できる。

効果音はWeb Audioの短い三角波・正弦波チャイム。外部音源・音声APIは使わない。初期OFF、手動操作後のみ有効。音量0・OFFは即時ミュートする。

共通指定（各プロンプトのPrimary requestの後に続ける）：

> Style: cozy whimsical folk-tale illustration, rounded shapes, midnight navy and warm amber palette, subtle paper texture, clean readable silhouette, warm hand-painted gouache, consistent gentle storybook look. Composition: square, centered with generous clear margins; simple strong shapes readable at small sizes.

生成形式：`Use case: illustration-story. Asset type: {用途}. Primary request: {個別指定} {共通指定} {透過指定} Constraints: no text, no letters, no watermark, no logo, no UI frame.`

用途はnoticeboard=`main 512x512 game click illustration`、tale=`512x512 collectible story illustration`、その他=`128x128 producer game icon`。透過指定は要の場合 `Isolate the subject on a genuinely transparent background.`、不要の場合は空。

|ファイル（public/assets/）|用途・論理サイズ|透過|個別指定（実際に送信した英語）|
|---|---|---|---|
|noticeboard.png|クリック対象・512×512|要|A small wooden street noticeboard with a pinned cream envelope and a tiny drawing of a walking postbox. A warm amber lantern hangs on its side, welcoming three-quarter view. No legible writing.|
|neighbors.png|同名IDの生産者・128×128|要|Two friendly neighbors in navy coats whispering beside a glowing amber street lamp, isolated compact group.|
|well.png|同名IDの生産者・128×128|要|Three friendly townspeople chatting around a quaint stone well with a small amber lantern, isolated compact group.|
|cafe.png|同名IDの生産者・128×128|要|A cozy small round cafe table with two cups, a warm window frame and friendly regulars exchanging a curious story, isolated compact group.|
|storyteller.png|同名IDの生産者・128×128|要|A traveling storyteller in a navy coat carrying a satchel full of illustrated story cards, isolated friendly figure.|
|broadcast.png|同名IDの生産者・128×128|要|A quaint rooftop radio tower with brass loudspeakers and a glowing lantern, isolated compact object.|
|birds.png|同名IDの生産者・128×128|要|Three migratory birds carrying tiny cream paper messages above a small curved navy rooftop, isolated compact group.|
|dreams.png|同名IDの生産者・128×128|要|A miniature night post office with a crescent moon and dream-shaped envelopes, warm lit windows, isolated compact building.|
|theater.png|同名IDの生産者・128×128|要|A small rounded theater with a shared starry dream projected above its roof, isolated compact building.|
|causality.png|同名IDの生産者・128×128|要|A mysterious friendly storyteller weaving amber ribbons between a tiny clock and a walking postbox, isolated compact group.|
|world.png|同名IDの生産者・128×128|要|A tiny storybook globe with a village surrounded by repeating amber speech-shaped clouds, isolated compact object.|
|tale.png|6ポイント挿絵・512×512|不要|A whimsical walking postbox wearing little shoes made of folded letters, footprints turning a street corner at dawn, warm amber windows and a soft navy sky, framed square storybook illustration on warm paper. No text.|

## Phase 8の絵葉書

追加の生成画像は使用しない。6枚の絵葉書には既存のbroadcast／well／cafe／birds／dreams／taleの画像を再利用し、CSSの枠と日本語の題・短文を添える。未獲得時は画像を隠し、獲得後に遅延読み込みする。追加の画像通信先・外部音源はない。
