# Open Base

SystemとCompanyを独立して利用するためのオープンソース基盤です。認証、認可、手続き、承認、監査、通知と、会社、従業員、雇用、組織の正本を提供します。API、CLI、MCP、Web UIを含みます。

会社固有のサービスや社内インフラには依存しません。個別の業務アプリは含みません。

## ローカル開発

Bunとportlessを用意し、次を実行します。

```sh
vp install
bun run --cwd web setup:dev-vars
bun run --cwd web db:migrate:local
make dev
```

画面とAPIは `https://base.localhost` です。APIは `/api` 配下にあります。直接の接続先は `http://127.0.0.1:18787` ですが、パスキーはIPアドレスのoriginで使えないため、ブラウザではホスト名で開きます。ホスト名は `portless.json` が正本です。

秘密値は `web/.env` に生成されます。本番の配備設定、秘密値、DB、個人情報をコミットしないでください。

## 初期化とサインイン

人のサインインは、パスワード・パスキー・OIDCから一つを配備ごとに選びます。`SIGN_IN_METHOD` に `password`、`passkey`（未設定時）、`oidc` のいずれかを設定します。それ以外の値ではサインインを受け付けません。選ばなかった方式の入口は404になります。

`SIGN_IN_METHOD`、`IDENTITY_ISSUER`、`OIDC_CLIENT_ID` は公開可能な配備設定です。ローカルでは、管理対象外の `web/void.deploy.json` の `cloudflare.vars` に設定します。`PEPPER_SECRET` と `OIDC_CLIENT_SECRET` は `web/.env` または配備先の秘密値へ保存します。

OIDCを選ぶときは、発行者を `IDENTITY_ISSUER`、client IDを `OIDC_CLIENT_ID` に設定し、IdPへ戻り先 `https://<host>/api/auth/oidc/callback` を登録します。認可codeとPKCEを使い、confidential clientなら `OIDC_CLIENT_SECRET` も設定します。ID tokenの `sub` に結び付いた有効な `oidc` のIdentityを持つAccountだけがサインインできます。

従業員データは自動投入しません。`web/.env` のBOOTSTRAP_TOKENと、確認済みの会社情報を使って初期化します。

```sh
bun cli/index.ts bootstrap --help
bun cli/index.ts bootstrap --email you@example.com \
  --company-data /path/to/confirmed-company.json \
  --idempotency-key "$COMMAND_ID" --token "$BOOTSTRAP_TOKEN"
```

初回は初期アカウントを作ります。パスワード方式では、サーバーに `PEPPER_SECRET` を設定し、初期パスワードを環境変数 `BASE_BOOTSTRAP_PASSWORD` で渡して `bootstrap --sign-in-method password` を実行します。秘密値を引数や履歴に残さないでください。パスキーの配備では、表示されたパスキー招待のURLをブラウザで開いてパスキーを登録します。OIDCの配備では `--oidc-subject` に初期管理者のIdPのsubjectを渡すと、そのIdentityでサインインできるアカウントを作ります。`bun cli/index.ts login` でログインしてから、同じコマンドをもう一度実行すると会社を初期化します。

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

COMMAND_IDはUUIDを使用します。初期化後はBOOTSTRAP_TOKENを設定から除去してAPIを再起動します。

パスキーの配備でアカウントを追加するときは、管理者がパスキーのIdentityを作り、返ったパスキー招待のURLを本人へ渡します。OIDCの配備では、IdPのsubjectを指定して `oidc` のIdentityを作ります。パスキーを失くした人には `POST /api/system/accounts/{accountId}/passkey-enrollments` で招待を発行し直します。管理者が全員サインインできなくなったときは、BOOTSTRAP_TOKENを一時的に設定し、`POST /api/system/passkey-recoveries` で復旧用の招待を発行します。

パスキーの招待を使って復旧すると、以前のパスキーとセッションは失効します。既存の鍵を残して追加するときは、本人がサインインし直してから追加します。

従業員を同時に登録する `POST /api/company/employee-registrations` も配備の方式を使います。パスワード方式は `password`、OIDC方式は `oidc_subject` を指定し、パスキー方式では返された招待を本人へ渡します。別方式の資格情報を一緒に送ると拒否します。

CLIの `login` はデバイス認証です。表示されたURLをブラウザで開き、サインインし直してコードを承認します。MCPはCLIのログインを共有します。再認証が必要な管理操作は、ブラウザでサインインした直後（5分以内）だけ行えます。OIDCではIdPで認証した時刻（`auth_time`）で判定し、再認証のときはIdPに認証し直しを求めます。

外部の認証サービスで管理操作やCLIへのログインを使うには、`max_age=0` による再認証と、ID tokenの `auth_time` が必要です。本人確認した時刻を証明できないサービスでは、通常のログインだけを受け付け、再認証を必要とする操作は拒否します。

## Service Bindingによる照会と操作

同じCloudflare accountの別Workerは、Service Binding RPCでAPIへaccess tokenを渡し、その本人のAccountを照会したり、その本人としてHTTP APIを呼んだりできます。RPC入口はWorkerの `ServiceBindingEntrypoint` で、公開URLやHTTP APIからは到達できません。methodは `whoami(accessToken)` と `request(accessToken, input)` です。

受理するtokenは、外部IdPが発行したEdDSAの `at+jwt` で、`aud` が `SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE` と一致する単一値のものだけです。発行者と検証鍵は `IDENTITY_ACCESS_TOKEN_ISSUER`（未設定なら `IDENTITY_ISSUER`）と `IDENTITY_JWKS`（未設定なら発行者のOpenID Connect discovery）を共有します。`sub`、`client_id`、`scope`、`iat`、`exp`、`jti` を必須とし、委任や交換を表す `act` を持つtokenは拒否します。`sub` は有効なIdentity bindingを通じてactiveな人のAccountへ対応付けます。

`SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE` が未設定、空、または `IDENTITY_ACCESS_TOKEN_AUDIENCE` や `IDENTITY_AUDIENCE` と同じ値のとき、RPC入口は全ての呼び出しを拒否します。HTTP APIは、Bearerとしてこのaudienceを含むtokenを受理しません。そのため同じ値を設定すると、HTTP APIの外部access tokenも拒否されます。

`whoami` の結果は `{ ok: true, account: { accountId } }`、または `{ ok: false, reason: "rejected" | "unavailable" }` です。拒否の理由は返しません。`unavailable` は検証鍵やDBを一時的に使えない状態を表します。

`request` は、tokenを `whoami` と同じ規則で検証したあと、HTTP APIと同じappへ要求を通します。routing、入力検証、認可、監査、エラーの形はその本人がHTTP APIを呼んだときと同じで、権限の無い操作は同じ403になります。検証済みの本人はWorker内部でだけ渡し、Authorization headerやHTTP要求からは指定できません。どの操作を利用者へ開くかは、bindingを持つWorkerが決めます。

`input` は `{ method, path, query, body }` です。`method` は `GET`、`HEAD`、`POST`、`PUT`、`PATCH`、`DELETE` のいずれか、`path` は `/` で始まる絶対pathで、scheme、host、`..`、query、fragmentを含められません。ASCII以外の文字などURLで符号化が必要な文字は、呼び出し側で百分率符号化して渡します。`query` は文字列の値だけを持つobject（100件まで）、`body` はJSONとして送る値（1 MBまで、GETとHEADでは不可）です。不正な入力は `{ ok: false, reason: "rejected" }` になり、appを呼びません。headerは渡せないため、`idempotency-key`、`if-match`、再認証などのheaderを必要とする操作はまだ呼べません。

デバイス認証の承認やパスキー招待の発行のように、認証済みの本人から別の資格情報を発行する経路は、RPCからは拒否します。短命のtokenを長命の資格情報へ変えさせないためです。

`request` の結果は `{ ok: true, status, headers: { contentType }, body, truncated }` です。JSONの応答は解析した値、それ以外は文字列で返します。本文が1 MBを超えるときは先頭1 MBを文字列で返し、`truncated` をtrueにします。

HTTP APIのレート制限は接続元IP単位です。RPCの要求には接続元IPが無いため、全てのRPC要求とIPの無い要求が一つの枠を共有します。Account単位の制限はまだありません。

呼び出す側のWorkerは、wrangler設定で次のようにbindingを宣言します。`service` にはAPIのWorker名を指定します。

```jsonc
{
  "services": [
    {
      "binding": "API",
      "service": "your-api-worker-name",
      "entrypoint": "ServiceBindingEntrypoint",
    },
  ],
}
```

```ts
const result = await env.API.whoami(accessToken)
if (result.ok) console.log(result.account.accountId)

const profile = await env.API.request(accessToken, {
  method: "GET",
  path: "/company/current-profile",
})
if (profile.ok && profile.status === 200) console.log(profile.body)
```

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

`web/tests/fixtures/released-migrations` は共有contextの過去のschema変換を検証するための固定fixtureです。業務テーブルの旧DDLも含みますが、実行時のmigrationや配備には使いません。実行時の正本は `web/src/db/migrations` だけです。

新規インストール用の基盤であり、他の製品の稼働DBへこのmigrationを適用しないでください。

開発規約は `AGENTS.md` と各contextの `AGENTS.md` に集約しています。
