import { defineEnv, string } from "void/env"

// サーバーの秘密値。ローカルは web/.env（`bun run setup:dev-vars` で生成）、本番は `void secret put` で登録する。
// 秘密値ではない設定（COMPANY_TIME_ZONE、CORS_ORIGIN など）は Worker の vars に置き、ここでは宣言しない。
// 公開リポジトリなので、実際に使える値やdefaultを書かない。値は「未設定」「16文字未満」「-change-me で終わる値」を実行時に拒否する。
export default defineEnv({
  // access token の署名鍵。
  JWT_SECRET: string(),
  // 監査イベントの識別子 HMAC 用。
  AUDIT_HMAC_SECRET: string(),
  // パスワード用pepper。未設定ならパスワード認証を拒否する。
  PEPPER_SECRET: string().optional(),
  // 添付の DEK を包む KEK。{"version": "base64 32 バイト"} 形式で、最大 version が現行鍵。未設定なら添付 API は 503 を返す。
  ATTACHMENT_KEKS: string().optional(),
  // OIDC の署名鍵（JWK set の JSON）。
  OIDC_SIGNING_KEYS: string().optional(),
  // 外部IdPの検証鍵（JWK set の JSON）。
  IDENTITY_JWKS: string().optional(),
  // 初期 ROOT の作成時だけ設定し、作成後は削除する。未設定なら POST /api/system/bootstrap は 404。
  BOOTSTRAP_TOKEN: string().optional(),
})
