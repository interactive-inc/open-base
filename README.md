# Open Base

SystemとCompanyを独立して利用するためのオープンソース基盤です。認証、認可、手続き、承認、監査、通知と、会社、従業員、雇用、組織の正本を提供します。API、CLI、MCP、Web UIを含みます。

会社固有のサービスや社内インフラには依存しません。個別の業務アプリは含みません。

## ローカル開発

Bunとportlessを用意し、次を実行します。

```sh
bun install
cp api/wrangler.example.jsonc api/wrangler.jsonc
cp web/.env.local.example web/.env.local
bun run --cwd api setup:dev-vars
bun run --cwd api db:migrate:local
make dev
```

APIは `https://base.localhost`、Web UIは `https://app.base.localhost` です。APIの直接接続先は `http://127.0.0.1:18787`。ホスト名は `portless.json` が正本です。

秘密値は `api/.dev.vars` に環境ごとに生成されます。本番の配備設定、秘密値、DB、個人情報をコミットしないでください。

## 初期化とログイン

既定のパスワードや従業員データは投入しません。`api/.dev.vars` のBOOTSTRAP_TOKENと、確認済みの会社情報を使って初期化します。

```sh
bun cli/index.ts bootstrap --help
bun cli/index.ts bootstrap --email you@example.com --password "$INITIAL_PASSWORD" \
  --company-data /path/to/confirmed-company.json \
  --idempotency-key "$COMMAND_ID" --token "$BOOTSTRAP_TOKEN"
```

会社情報JSONには以下の形式を使います。実際の情報を記入したファイルはリポジトリ外に置いてください。

```json
{
  "name": "Example User",
  "code": "E001",
  "organization_name": "Example Organization",
  "representative_name": "Example Representative",
  "initial_responsibilities": [],
  "hire_date": "2026-01-01",
  "employment_type": "FULL_TIME",
  "locale": "ja-JP",
  "time_zone": "Asia/Tokyo",
  "fiscal_year_start_month": 4,
  "reason": "Confirmed initial organization facts"
}
```

COMMAND_IDはUUIDを使用します。初期化後はBOOTSTRAP_TOKENを設定から除去してAPIを再起動します。Web UIで登録したメールアドレスとパスワードを使ってログインできます。外部IdPも環境変数で設定できます。

## CLIとMCP

CLIは `base` コマンド、`BASE_API` などの環境変数を使用します。API接続先ごとに認証情報を分けて保存します。

```sh
bun cli/index.ts --help
bun cli/index.ts login --help
bun mcp/index.ts
```

MCPは標準入出力で起動します。`.mcp.json` の接続設定も使用できます。CLIで対象APIへログインすると、MCPも同じ接続先の認証情報を利用します。

## 検証とDB

```sh
make ci
```

新規DBにはSystemとCompanyのテーブル、view、制約、初期カタログだけを作成します。実データや業務アプリのテーブルは作成しません。ローカルD1の受入テストで初期化、認証、雇用、組織、判断資格、承認、通知、監査を検証します。

`api/tests/fixtures/released-migrations` は共有contextの過去のschema変換を検証するための固定fixtureです。業務テーブルの旧DDLも含みますが、実行時のmigrationや配備には使いません。実行時の正本は `api/migrations` だけです。

新規インストール用の基盤であり、他の製品の稼働DBへこのmigrationを適用しないでください。

開発規約は `AGENTS.md` と各contextの `AGENTS.md` に集約しています。
