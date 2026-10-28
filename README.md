# Happy Clicker Games

Claude Code と Codex が、それぞれ題材・世界観・タイトルから考えて作った、2つのクリッカー＋放置ゲームです。
ブラウザだけで遊べます（インストール不要・PC／スマホ対応）。

**▶ トップページ：https://laplaciannin102.github.io/happy_clicker_games/**

| ゲーム | 制作 | あそぶ |
|---|---|---|
| **Contagious Yawns**（あくび、うつった。）<br>あくびがうつって、部屋から町、星、銀河へ。世界がだんだん眠くなる。 | Claude Code | [https://laplaciannin102.github.io/happy_clicker_games/contagious_yawns/](https://laplaciannin102.github.io/happy_clicker_games/contagious_yawns/) |
| **Rumor Garden**（うわさの育て方）<br>小さな話が、世界の法則になる。架空の街でうわさを育てる。 | Codex | [https://laplaciannin102.github.io/happy_clicker_games/rumor_garden/](https://laplaciannin102.github.io/happy_clicker_games/rumor_garden/) |

## 遊ぶときのメモ

- セーブデータはゲームごとに、お使いのブラウザ（localStorage）へ自動で保存されます。2つのゲームのセーブは混ざりません。
- ブラウザのデータを消すとセーブも消えます。各ゲームの設定画面から、セーブ文字列やファイルとして書き出して保管できます。
- 遊び方は、各ゲーム内の「遊び方」タブで確認できます。

## 自分のPCで動かす

Node.js 20.19 以上と npm が必要です。ゲームごとのフォルダで実行します。

```sh
cd contagious_yawns   # または cd rumor_garden
npm ci
npm run dev
```

## フォルダ構成

| パス | 内容 |
|---|---|
| [`contagious_yawns/`](contagious_yawns/) | 『Contagious Yawns（あくび、うつった。）』のソースコード |
| [`rumor_garden/`](rumor_garden/) | 『Rumor Garden（うわさの育て方）』のソースコード |
| `index.html` | トップページ（2つのゲームへのリンク） |
| `.github/workflows/deploy.yml` | `main` への push で2つのゲームをビルドし、GitHub Pages へ公開 |

## クレジット

- 制作：[laplaciannin102](https://github.com/laplaciannin102)
- 開発：Claude Code（Anthropic）／ Codex（OpenAI）
- イラスト：OpenAI の画像生成（ChatGPT）で作成
- 効果音：Web Audio で合成
- 大きな数の計算：[break_eternity.js](https://github.com/Patashu/break_eternity.js)（MIT License）
