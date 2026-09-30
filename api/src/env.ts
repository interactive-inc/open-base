import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { schema } from "@/schema"
import type {
  SystemD1Context,
  SystemDatabaseContext,
  SystemEmailSender,
  SystemRequestAudit,
  SystemRequestAuditContext,
} from "@system/configuration/system-context"
import type { OidcClientRegistryValue } from "@system/domain/values/oauth/oidc-client-registry.value"
import type { OidcIssuerConfigurationValue } from "@system/domain/values/oauth/oidc-issuer-configuration.value"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type { AccessTokenClaims } from "@system/domain/schemas/auth/access-token-claims.schema"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** Workers のバインディング（wrangler の vars / secrets / D1）。 */
export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  OIDC_SIGNING_KEYS?: string
  // password hash用pepper。本番ではlocal seed値と異なるsecretを必ず設定する。未設定時は認証を拒否する。
  PEPPER_SECRET?: string
  EMAIL?: SystemEmailSender
  EMAIL_SENDER_NAME?: string
  INVITE_EMAIL_FROM?: string
  INVITE_EMAIL_SEND_ENABLED?: string
  OIDC_CLIENT_REGISTRY?: unknown
  OIDC_ISSUER_CONFIGURATION?: unknown
  // 添付本体（暗号文）を保管する R2 バケット。未設定なら添付機能は 503 を返す。
  ATTACHMENTS?: R2Bucket
  // 添付の DEK を包む KEK。`{"1": "<base64 32 bytes>"}` 形式で、最大 version が現行鍵。
  // ローテーション中は旧 version も残す。`wrangler secret put ATTACHMENT_KEKS` で登録する。
  ATTACHMENT_KEKS?: string
  // "true" なら Worker の定期起動で、保持期限を過ぎた未紐付け添付を掃除する。
  // 未設定・空・"false" なら定期起動では掃除しない。それ以外の値は定期起動を失敗させる。
  ATTACHMENT_PURGE_SCHEDULE_ENABLED?: string
  // "true" なら Worker の定期起動で、添付行と本体の実在を照合する。位置と結果は System batch job、
  // 欠損と失敗は System 通知へ記録する。未設定・空・"false" なら照合しない。それ以外の値は失敗させる。
  ATTACHMENT_RECONCILE_SCHEDULE_ENABLED?: string
  // 監査イベントの識別子 HMAC 用。`wrangler secret put AUDIT_HMAC_SECRET` で登録する。
  AUDIT_HMAC_SECRET: string
  // 人事上の会社営業日を求める IANA タイムゾーン。未設定・不正値は認証と人事変更を拒否する。
  COMPANY_TIME_ZONE?: string
  LEAVE_NOTIFICATION_SERVICE_ACCOUNT_ID?: string
  ONBOARDING_SERVICE_ACCOUNT_ID?: string
  ONBOARDING_AUTOMATION_FROM?: string
  // CORS で許可する Origin をカンマ区切りで指定する（例: "https://app.example.com,https://admin.example.com"）。
  // 未設定時はローカル開発用 Origin のみ許可。本番では必ず設定する。
  CORS_ORIGIN?: string
  // テストで現在時刻を固定するための注入点（本番では未設定 = 実時計）。
  NOW?: string
  // 外部業務台帳の停止世代を、同じデータ集合へ束縛する環境固有namespace。
  RECORD_SOURCE_NAMESPACE?: string
  // 有効化する opt-in App 機能。"all" か機能キーのカンマ区切り（例: "thanks,one-on-ones"）。
  // 未設定・空・"none" は全 opt-in App 機能を無効にする（.docs/feature-tiers.md の既定）。
  ENABLED_OPT_IN_APPS?: string
  // 停止する default App 機能のカンマ区切り（例: "rooms,rentals"）。"all" で全停止。未設定は全て有効。
  DISABLED_DEFAULT_APPS?: string
  // ログインエンドポイントのレート制限カウンターを保持する KV namespace。
  // `wrangler kv:namespace create RATE_LIMIT` で発行し wrangler.jsonc に設定する。
  RATE_LIMIT?: KVNamespace
  // ログイン以外の全エンドポイントの IP 単位グローバルレート制限（Workers Rate Limiting binding）。
  // wrangler.jsonc の ratelimits で設定する。未設定（ローカル開発・テスト）ではスキップする。
  API_RATE_LIMITER?: RateLimit
  // ローカル・テスト用の公開JWKS。未設定の本番ではIDENTITY_ISSUERのJWKS endpointを使う。
  IDENTITY_JWKS?: string
  // 外部 identity トークンに期待する iss（発行者）。未設定なら identity ログインを拒否する。
  IDENTITY_ISSUER?: string
  // 外部 identity トークンに期待する aud（想定受信者）。未設定なら identity ログインを拒否する。
  IDENTITY_AUDIENCE?: string
  // API access tokenの発行者。identityログインと異なるIdPを使う場合に設定する。
  // 未設定なら後方互換としてIDENTITY_ISSUERを使う。
  IDENTITY_ACCESS_TOKEN_ISSUER?: string
  // resource-bound access tokenをAPI Bearerとして直接受理するときだけ設定する。
  // 未設定なら従来のSystem sessionだけを受理する。
  IDENTITY_ACCESS_TOKEN_AUDIENCE?: string
  // 初期 ROOT 作成用。`wrangler secret put BOOTSTRAP_TOKEN` で登録し、初期化完了後は削除を推奨。
  // 未設定時は機能無効（POST /system/bootstrap は 404 を返す）。
  BOOTSTRAP_TOKEN?: string
  // CLI（ネイティブアプリ）ログインで、本人確認を委ねる外部 identity provider（ブローカー）のログイン URL。
  // canonical System CLI authorization APIはこのURLへcallback/state/PKCE challengeを付けて302する。
  // 未設定なら CLI ログインを一律拒否する。
  IDENTITY_LOGIN_URL?: string
  // この API 自身の外部公開 origin（例: "https://api.example.com"）。
  // ブローカーへ渡す callback URL の組み立てと、identity トークンの audience 検証に使う。
  // 未設定なら CLI ログインを一律拒否する。
  API_ORIGIN?: string
}

export type RequestAuditContext = SystemRequestAudit

/** リクエストスコープの変数。database に Drizzle、session に本人（CompanySessionValue。認可判定は session.hasPermission）を載せる。 */
export type Variables = {
  bearerReadAuthentication?: SystemReadAuthentication
  systemAccessToken?: AccessTokenClaims
  companyActor?: CompanyActorValue
  companyClock?: () => Date
  database: DrizzleD1Database<typeof schema>
  session: CompanySessionValue | null
  auditContext: RequestAuditContext
  now: () => Date
  // 認証middlewareが検証済みAccountIdだけを設定する。利用側で再検証しない。
  userId: AccountId
  accountTokenVersion: number
  permissions: ReadonlySet<string>
  scopedPermissions?: ReadonlyMap<string, ReadonlySet<string>>
  role: string
  roleKeys?: ReadonlyArray<string>
  oidcClientRegistry: OidcClientRegistryValue
  oidcIssuerConfiguration: OidcIssuerConfigurationValue
}

/** 認証済み主体を読む処理が要求する Context。userId は認証境界で検証済みの AccountId。 */
export type AuthenticatedAccountContext = Readonly<{
  var: Readonly<{ userId: AccountId }>
}>

/** Hono の Env。new Hono<HonoEnv>() / createFactory<HonoEnv>() で使う。 */
export type HonoEnv = {
  Bindings: Bindings
  Variables: Variables
}

/** リポジトリ・ユースケースが受け取る Context の最小型。 */
export type Context = SystemDatabaseContext &
  SystemD1Context &
  SystemRequestAuditContext & {
    var: Pick<Variables, "companyActor" | "database" | "session" | "auditContext">
    env: Bindings
  }
