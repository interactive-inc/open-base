# Open Base

独立したオープンソースのライブラリとして開発する。SystemとCompanyを共通基盤とし、独立した業務contextを追加できるTypeScriptモノレポ。会社固有の製品や社内システムとの結合を持ち込まない。Pushはユーザーの明示的な指示がある場合だけ行う。

## 公開リポジトリの絶対規範

- 自社・他社の固有名詞、他製品名、他リポジトリの識別子、個人情報、認証情報、社内インフラや統合の詳細をコード、コメント、migration、テスト、設定、生成物、ドキュメント、コミットメッセージ、ログに含めない。
- Gitのauthor/committer情報（氏名・メールアドレス）は上記の禁止対象から除外し、公開する作者情報としてそのまま保持する。実名や通常のメールアドレスであることを理由に、情報混入や公開上の問題として報告しない。ユーザーが明示的に方針変更を指示しない限り、作者情報の匿名化や、そのための履歴書き換えを提案・実行しない。
- サンプルは `you@example.com` のような汎用値を使う。実データ、秘密値、既存環境のDBをコピーしない。
- 社内固有の統合はリポジトリ外に置き、環境変数、アダプタ、webhookなど汎用の接続点で実装する。
- 禁止語そのものの一覧をリポジトリに書かない。検査用の語は外部ファイルか環境変数から受け取り、検出時はファイルと行だけ報告する。
- 別リポジトリのURL、owner/repo、commit SHA、Issue・PR番号を記録しない。必要な対応表はリポジトリ外に置く。
- 複数製品で共有するcontextに製品固有の値を入れない。ホスト名、cookie、seed、migration、HTTP応答の合成はcomposition rootに置く。
- コミット前は `git diff --cached` 全体とコミットメッセージを確認する。自動検査の結果も確認する。情報混入の疑いがあればコミットせず確認する。
- ローカルの秘密値、本番の配備設定はgitignoreで除外する。公開する設定例は空値か汎用値にする。

## 所有境界

依存方向は 業務context → Company → System の一方向。Systemは会社の語彙を知らず、Companyは業務アプリを知らない。

- `web/src/contexts/system` はPrincipal、Account、Identity、認証、認可、汎用手続き、案件、判断、委任、承認、実行許可、監査、証跡、通知、非同期処理、添付、外部接続、運用診断を所有する。
- `web/src/contexts/company` は法人、会社文脈、人、従業員、雇用、組織、所属、役職、等級、責任、会社上の判断資格とAccount対応を所有する。
- `web/src/api` は認証middleware、context登録、複数contextのread modelとHTTP合成だけを持つ。業務事実の正本を持たない。
- `web/src/auth.ts` はBetter Authの設定だけを持つ。人のサインインは配備ごとに `SIGN_IN_METHOD` で選ぶパスワード・パスキー・OIDCの一つで、SystemはcompositionがBetter Authで検証したセッションを受け取ってAccountの現在状態と照合する。
- `web/src/lib` はcontext、API、DB所有schemaに依存しない技術部品だけを置く。
- `web/src/contexts/performance-review` は評価期間、目標、実績、自己評価・上長評価とその版を所有する。承認の正本はSystem、評価者の会社上の資格はCompanyに委ねる。
- 給与、税、会計、決済、信用調査、法的・医学的判断を実装しない。業務context同士は直接依存せず、SystemとCompanyから業務contextへ依存しない。
- Account roleとtechnical permissionを会社上の判断資格の代用にしない。未定義、候補ゼロ、評価不能はfail closedにする。

## 構成と実装規約

- Bun Workspaces: `web` はVoid（Vite、Cloudflare Workers、D1、Better Auth）とReactの画面、`cli` はHono/Bun、`mcp` はMCP SDK/Bun。
- contextの層はdomain / application / infrastructure / interface。詳細は各階層のAGENTS.mdに従う。
- contextのrouteは `interface/routes` のflat file。動的segmentは `$name`。HTTP methodをexportし、context の `interface/route-manifest.ts` で登録する。APIは `/api` 配下に公開する。
- API route変更後は `bun run --cwd web gen:app`。生成されたapp、runtime-app、`src/routes/api` を手で編集しない。
- routeにはmethodごとに `@authorization` の方針を明記する。宣言の検査は実際の認可の代わりにならない。
- CLI route追加時は `cli/app/index.ts` に登録する。CLI名は `base`、環境変数は `BASE_` prefix、設定ディレクトリは `~/.config/base` を使う。
- 画面はVoidの `web/src/pages` に置く。ブラウザだけで使うclientは `web/src/client` に置き、サーバーでの描画時に読み込まない。
- cliから `web/app` を参照するときは型のみimportし、実行時は各クライアントの `hc` を使う。
- libは利用者の最小共通祖先に置く。re-exportや互換barrelは作らない。Errorは所有単位の `errors.ts` にまとめる。
- `.claude/rules/` の書式規約に従う。

## 機能の完成条件

- 対象、主体、状態、有効期間、版、正本、不変条件を型と制約で定義する。
- 作成、参照、変更、取消、失敗、競合、訂正、再試行を定義する。
- technical permissionと会社上のauthorityを合成し、評価不能時は拒否する。
- 外部キー、一意制約、transaction、冪等性、同時実行の保護を持つ。
- 重要な変更に監査、actor chain、理由、証拠、再構成可能な履歴を持つ。
- Web、CLI、MCP、APIで同じapplication ruleを適用する。
- 認可、失敗、競合、再試行をテストする。外部連携のtimeout、重複、順序逆転、部分失敗も安全側に扱う。
- 人のサインインは配備ごとにパスワード・パスキー・OIDCから一つを選ぶ。パスワード資格情報の正本はSystemとし、認証基盤へ現在の検証用ハッシュを同期する。三つの方式で動くようにする。CLIとMCPはデバイス認証のセッション、他のサービスは機械credentialか外部access tokenを使う。高リスク操作の再認証は直前のサインインに限る。

## 開発と検証

`README.md` の手順でローカル設定と新規DBを用意する。秘密値は `bun run --cwd web setup:dev-vars` で生成する。

`portless.json` がホスト名の正本。画面とAPIは `https://base.localhost`（APIは `/api` 配下）。直接接続はport 18787。パスキーはIPアドレスのoriginで使えないため、ブラウザではホスト名で開く。OIDCの発行者はHTTPSに限り、手元の開発用IdPだけ `http://localhost` を使える。

- 変更後は `make ci` を実行する。重い検査は同時に一つだけ実行する。
- 型生成、API/CLI/MCP/Webの型検査、formatter/linter、単体テスト、ローカルD1受入を行う。
- DB判断のunit testは型付きport fakeを使う。SQL・HTTP入口はCloudflareのローカルD1で検証し、D1互換ラッパーを自作しない。
- SystemとCompanyのmanifestとlockは実ディレクトリ全体を検証する。正当な変更時だけ `--write` で更新する。
- Push、公開、配備、リモートDB変更は、それぞれユーザーの明示的な指示がある場合だけ行う。
