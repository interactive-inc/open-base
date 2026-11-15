# 開発用モック

- 架空の固定シードだけを扱う。実データ、資格情報、本番DB、配備設定を読み込まない。
- 利用単位ごとに `createMockState` で独立した状態を作る。テスト間でsingletonを共有しない。
- ブラウザー向けのseedとhandlerはNode・Bun・SQLiteへ依存しない。永続化とViteの接続は別のexportで所有する。
- SQLiteはOSの一時ディレクトリー配下だけを受け付け、利用者がcloseと不要ファイルの削除を行う。D1の互換実装やDB受入試験の代替を作らない。
- 未定義のAPIは501で明示し、実バックエンドへ流さない。パスキーの成功や本番認可の安全性を捏造しない。
- 通常のproduction entryからこのpackageを読み込まない。モック用Vite設定とStorybook、試験だけで使用する。
- 検証入口はrootの `vp run check:mock` と `vp run test:mock`。
- 機能の領域ごとの状態と経路は `src/areas/<領域>.ts` に置き、`src/areas/index.ts` に並べる。領域は自分の経路でなければnullを返す。応答の形は本物のAPIに合わせる。
- Viteの設定からNodeが型を取り除くだけで読み込む。enum、namespace、コンストラクターの引数をそのまま項目にする書き方は使わない。
