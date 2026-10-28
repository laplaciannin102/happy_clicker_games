# ASSETS — 画像一覧と生成プロンプト

画像は別途 AI で生成して差し替えます（SPEC §8）。**1枚も無くてもゲームは動きます**（いまは絵文字で表示しています）。

## 置き場所と決まり

- 置き場所：`src/assets/images/<種類>/<ID>.png`（例：`src/assets/images/producers/cat.png`）
  - ファイル名の ID は `src/data/` の ID と同じにします。
  - 置いた画像だけがビルドに入り、絵文字の代わりに表示されます。置いていない画像は絵文字のままです。
  - 差し替えたら `npm run build` し直します（GitHub Pages ではデプロイ時に自動でビルドされます）。
- SPEC の目安は `public/assets/` ですが、`src/assets/images/` にしました（理由は DESIGN.md §13）。
- 形式：PNG・背景は透過・正方形。
- サイズ：基本は **128×128**。メインキャラクター（`main/yawn`）だけ **512×512**。
- 表示サイズは CSS で決まります（生産者 32px 前後、メインキャラクター 56〜96px）。小さく表示しても形がわかる、太めの線と大きな形で描きます。

## 共通のスタイル指定文

すべてのプロンプトの先頭に、次の文をそのまま付けます。

```
STYLE: soft pastel night-sky palette (lavender #8b7bd8, pale violet, cream yellow, misty blue), cute sleepy mood,
rounded chunky shapes, thick soft outlines in dark indigo, flat shading with one gentle highlight, no text, no letters,
single centered subject, fills about 80% of the canvas, transparent background, readable at 32x32 pixels,
consistent sticker-like game icon, square 1:1
```

下の表の Prompt は、このスタイル指定文と一緒に、シートのプロンプト（SHEET_PROMPTS.md）に入っています。

## ChatGPT でまとめて作る（おすすめ：9回送るだけ）

1枚に12個のアイコンを並べた「シート」を描いてもらい、`npm run images` で1個ずつに切り分けます。
約80枚が、**シート7枚＋1枚で描く絵2枚＝9回のメッセージ**で済みます（Phase 8 で sheet7 と `main/dawn` が増えました）。

### 使うもの

- **[SHEET_PROMPTS.md](SHEET_PROMPTS.md)**：ChatGPT にそのまま貼るプロンプト9つ（シート1〜7、メインキャラクター、エンディングの絵）。
  各プロンプトの見出しに、保存するファイル名が書いてあります。
- **添付する画像**：2通目からは、気に入った1枚目のシートを添付します（絵柄をそろえるため）。

### 手順

1. ChatGPT で新しい会話を開き、SHEET_PROMPTS.md の「1. sheet1」のプロンプトを貼って送ります。
2. 12個がそろっていて、絵柄が気に入ったら、PNG でダウンロードして `art/raw/sheets/sheet1.png` として保存します。
   気に入らなければ「もう一度」と頼みます。
3. 同じ会話で、**1枚目のシートを添付して**、「2. sheet2」のプロンプトを送ります。保存先は `art/raw/sheets/sheet2.png`。
   同じようにシート7まで続けます。
4. 最後に、1枚目のシートを添付して「8. main/yawn」「9. main/dawn」を送り、`art/raw/main/yawn.png`・`art/raw/main/dawn.png` として保存します。
5. `contagious_yawns` のフォルダで `npm run images` を実行します（次の「生成した画像の置き方」）。

### 気をつけること

- **マスの順番どおりに描かれているか**を確かめます（左上から右へ、1〜12）。順番が違うと別の絵として切り出されます。
  違っていたら `Keep exactly the cell order I listed.` と頼んで描き直してもらいます。
- **絵どうしがくっついていないか**を確かめます。くっついていると、1つの絵として切り出されます。
- **文字や番号が描かれていたら**、`Remove all numbers, labels and text.` と頼みます。
- 背景は透明が理想ですが、白や市松模様でも、ふちから続く背景は自動で消します（⚠ が出ます。仕上がりを見て確かめてください）。
- シートのうち1つだけ気に入らない絵があれば、その絵だけ1枚で描いてもらい、`art/raw/<種類>/<ID>.png` に置きます。
  1枚で置いた絵は、シートより優先されます。1枚で頼むときは、SHEET_PROMPTS.md の「8.」のプロンプトの `SUBJECT:` を、下の表の Prompt に差し替えます。
- 1つの会話が長くなると絵柄がずれやすいので、ずれてきたら新しい会話で、1枚目のシートを添付してやり直します。

## 生成した画像の置き方

| 画像 | 置き場所（`contagious_yawns` の中） |
|---|---|
| シート（12個入り） | `art/raw/sheets/sheet1.png` 〜 `sheet7.png` |
| 1枚で描いた絵（メインキャラクター・描き直し） | `art/raw/<種類>/<ID>.png`（例：`art/raw/main/yawn.png`） |

- ファイル名は半角の小文字・数字・`_` だけにします。
- `art/raw/` は git に入れない設定です（`.gitignore`）。ChatGPT の元の画像は大きいので、手元で保管してください。
- 置いたら、`contagious_yawns` のフォルダで次を実行します。

  ```
  npm run images
  ```

  - シートを切り分けたり1枚の絵を縮めたりして、`src/assets/images/<種類>/<ID>.png` に書き出します。
    大きさは、メインキャラクターが 512×512、それ以外は 128×128 です。
  - 書き出した画像は git に入れます（GitHub Pages で表示するため）。
  - 2回目からは、置き直したものだけ書き出します。全部やり直すときは `npm run images -- --force` を使います。
  - うまくいかなかったもの（絵が見つからないマス、PNG でない画像、名前の形が違う画像など）は、⚠ や ✗ で知らせます。
  - 依存パッケージは使いません（`scripts/png.ts`・`scripts/slice.ts`）。
- `npm run dev` か `npm run build` で確かめます。置いた画像だけが絵文字と入れ替わります。
- シートの並びやプロンプトを変えるときは `scripts/sheets.ts` を直し、`npm run images:prompts` で SHEET_PROMPTS.md を作り直します。
  下の表の Prompt と `scripts/sheets.ts` の文は、テストで一致を確かめています（片方だけ直すとテストが落ちます）。

## A. まず欲しいもの（画面にいちばん出る）

| ファイル | 用途 | サイズ | Prompt（英語） |
|---|---|---|---|
| `main/yawn.png` | クリック対象（中央の大きな顔） | 512×512 | a round soft character face doing a huge contagious yawn, eyes squeezed shut, small tear at the corner of one eye, tiny "z" shaped sparkles around, plush and huggable |
| `producers/cat.png` | 生産者：眠そうな猫 | 128 | a sleepy cat curled up, half-closed eyes, mid-yawn |
| `producers/lecture.png` | 生産者：退屈な授業 | 128 | an open textbook in front of a small chalkboard with wavy lines, a drowsy aura |
| `producers/meeting.png` | 生産者：長すぎる会議 | 128 | a briefcase and a long meeting table with a ticking clock above, drowsy mood |
| `producers/assembly.png` | 生産者：校長先生の朝礼 | 128 | a microphone on a stand on a school stage podium, sleepy morning sun |
| `producers/radio.png` | 生産者：子守唄ラジオ | 128 | a retro radio playing soft music notes shaped like moons |
| `producers/kotatsu.png` | 生産者：こたつ | 128 | a cozy kotatsu table with a quilt and a bowl of mandarin oranges on top |
| `producers/local_train.png` | 生産者：昼下がりの各駅停車 | 128 | a small local train car in afternoon light, curtains half drawn |
| `producers/sheep.png` | 生産者：数えられる羊の群れ | 128 | three fluffy sheep in a row jumping over a little fence |
| `producers/moon.png` | 生産者：あくびする月 | 128 | a crescent moon with a face, yawning widely |
| `producers/front.png` | 生産者：眠気前線 | 128 | a soft drowsy cloud front with a weather map curve and sleepy face |
| `producers/galaxy.png` | 生産者：夜更かし銀河 | 128 | a swirl galaxy with sleepy half-closed eyes in the center |
| `producers/big_yawn.png` | 生産者：宇宙のおおあくび | 128 | the whole universe shaped like an enormous yawning mouth full of stars |
| `stars/star.png` | 流れ星（拾うと効果） | 128 | a shooting star with a short glowing cream-yellow tail, friendly sparkle |
| `sheep/normal.png` | 羊を数える：ふつうの羊 | 128 | a fluffy white sheep running to the right, side view |
| `sheep/slow.png` | 羊を数える：のんびりな羊 | 128 | a fluffy white sheep walking slowly to the right with a sleepy face, side view |
| `sheep/feint.png` | 羊を数える：フェイントの羊 | 128 | a fluffy white sheep stopping short with a mischievous face, side view |
| `sheep/black.png` | 羊を数える：黒い羊（数えない） | 128 | a fluffy dark charcoal sheep running to the right, side view |
| `sheep/rare.png` | 羊を数える：めずらしい羊 | 128 | a fluffy white sheep with a tiny glowing halo, running to the right, side view |
| `sheep/fence.png` | 羊を数える：さく | 128 | a small wooden fence, front-side view, simple |

## B. 次に欲しいもの（ページの一覧）

### 羊の図鑑（めずらしい羊）

| ファイル | 名前 | Prompt（英語） |
|---|---|---|
| `sheep/gold.png` | 金の羊 | a fluffy golden sheep with shiny wool |
| `sheep/cloud.png` | 雲の羊 | a sheep made of a soft white cloud, floating |
| `sheep/star.png` | 星の羊 | a sheep with tiny stars twinkling in its wool |
| `sheep/pajama.png` | パジャマの羊 | a sheep wearing striped pajamas and a nightcap |
| `sheep/moon.png` | 月の羊 | a pale sheep curled on a crescent moon |

### チャレンジ「眠れない夜」

| ファイル | 名前 | Prompt（英語） |
|---|---|---|
| `challenges/coffee.png` | コーヒー解禁 | a steaming coffee mug with wide-awake eyes |
| `challenges/cats_only.png` | 猫しかいない | three sleepy cats sitting in a row |
| `challenges/all_nighter.png` | 徹夜明け | a city window at dawn with a tired desk lamp still on |
| `challenges/cram.png` | 一夜漬け | a tall stack of books with an alarm clock on top |
| `challenges/insomnia.png` | 不眠症 | a wide-open eye under a moon, restless |
| `challenges/alarms.png` | 目覚まし時計だらけ | many small alarm clocks ringing together |
| `challenges/rush_hour.png` | 満員電車 | a packed commuter train car with hanging straps |
| `challenges/jet_lag.png` | 時差ボケ | an airplane between a sun and a moon, dizzy swirl |

### ぬくもりショップ（冬眠）

| ファイル | 名前 | Prompt（英語） |
|---|---|---|
| `warmth/w_entry.png` | 夢への近道 | a small round door glowing with dream light |
| `warmth/w_production.png` | ゆたんぽ | a cute hot water bottle wrapped in a knitted cover |
| `warmth/w_auto_prestige.png` | 寝ぐせの目覚まし | an alarm clock with messy bed hair, crescent moon on its face |
| `warmth/w_fast_auto.png` | てきぱき秘書 | a tiny efficient secretary owl holding a clipboard, speed lines |
| `warmth/w_shards.png` | 夢見がちな毛布 | a fluffy blanket with sparkling dream crystals |
| `warmth/w_stars.png` | 星降る天窓 | a skylight window with stars falling through |
| `warmth/w_auto.png` | 寝言の秘書 | a folder of papers with a speech bubble showing "z" shapes (no letters) |
| `warmth/w_offline.png` | 長い長い夜 | a little house under a very long starry night |
| `warmth/w_chain.png` | あくびの記憶 | a chain of linked soft rings glowing |
| `warmth/w_production2.png` | 小春日和 | a warm winter sun over a sleepy field |

### 夢のツリー（おやすみ）

| ファイル | 名前 | Prompt（英語） |
|---|---|---|
| `dream/root.png` | 夢の入口 | a crescent moon gate opening into a dream |
| `dream/m1.png` | ぬくぬく布団 | a puffy futon bed |
| `dream/m2.png` | 猫の添い寝 | a cat sleeping on a pillow |
| `dream/m3.png` | 授業の録音 | a small cassette recorder next to a textbook |
| `dream/m4.png` | 深い眠り | a person-shaped silhouette sinking into soft clouds, "z" shapes |
| `dream/m5.png` | 羊毛まくら | a pillow made of fluffy sheep wool |
| `dream/m6.png` | 夢の残り香 | a teacup with dreamy steam curling into stars |
| `dream/chain.png` | 眠気の連鎖 | soft chain links spreading yawns from one to the next |
| `dream/m7.png` | 熟睡のコツ | a sleeping mask with a small star badge |
| `dream/m8.png` | 眠りの達人 | a nightcap with a small crown |
| `dream/n1.png` | 寝言でもあくび | a speech bubble shaped like a yawn |
| `dream/n2.png` | 寝言の帳簿 | a notebook with tally marks |
| `dream/n3.png` | 夢うつつの連打 | a finger tapping softly, motion rings |
| `dream/n4.png` | 寝言の会計係 | a ledger book with a tiny abacus |
| `dream/n5.png` | まくら工房の夢 | a needle and thread over a pillow |
| `dream/n6.png` | 寝言の管理職 | a stack of neatly organized folders |
| `dream/n7.png` | 自動まくら | a small friendly robot sewing a pillow |
| `dream/d1.png` | 夜空を見上げる | a small telescope pointing at the night sky |
| `dream/d2.png` | 長い夜 | a city skyline under a deep night sky |
| `dream/d3.png` | 流れ星の尾 | a comet with a long glowing tail |
| `dream/d4.png` | ぐっすり留守番 | a cozy house with a sleeping figure in the window |
| `dream/d5.png` | 願いの瞬き | twinkling sparkles of a wish |
| `dream/d6.png` | 夢日記 | a diary with a moon on the cover |
| `dream/d7.png` | 明晰夢 | a crystal ball showing a dream scene |
| `dream/cross.png` | 夢の交差点 | a rainbow arching over three dream paths meeting |

## D. Phase 8 で増えたもの（sheet7 と、エンディングの絵）

### 夢くじの絵柄・夢の続き（sheet7）

| ファイル | 名前 | Prompt（英語） |
|---|---|---|
| `lottery/moon.png` | 月 | a round slot-machine token showing a sleepy crescent moon |
| `lottery/star.png` | 星 | a round slot-machine token showing a smiling five-pointed star |
| `lottery/sheep.png` | 羊 | a round slot-machine token showing a fluffy sheep face |
| `lottery/cloud.png` | 雲 | a round slot-machine token showing a soft puffy cloud |
| `lottery/futon.png` | 布団 | a round slot-machine token showing a folded futon with a pillow |
| `lottery/coffee.png` | コーヒー | a round slot-machine token showing a steaming coffee cup with wide-open eyes |
| `dream/encore.png` | 夢の続き | a door made of starry night sky opening onto another, deeper dream |

### エンディング（1枚で大きく、512×512）

| ファイル | 用途 | サイズ | Prompt（英語） |
|---|---|---|---|
| `main/dawn.png` | めざめ（エンディング）の絵 | 512×512 | a sleepy cat stretching on a windowsill as warm morning sunlight comes through parted curtains, the last few stars fading in a pale dawn sky |

## C. あってもよいもの（いまは絵文字のまま）

- まくら工房（`upgrades/<アップグレードID>.png`、101個）と実績（`achievements/<実績ID>.png`、88個）も、同じ決まりで置けば表示されます。
  数が多いので、いまは絵文字のままにしています。ID は `src/data/upgrades.ts`・`src/data/achievements.ts` を見てください。
- ファビコンは、いまは 🥱 の絵文字を SVG にして `index.html` に埋め込んでいます。
