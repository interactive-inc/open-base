import { defineEnv, string } from "void/env"

// サーバーの秘密値。ローカルは web/.env（`bun run setup:dev-vars` で生成）、本番は `void secret put` で登録する。
// 秘密値ではない設定（COMPANY_TIME_ZONE、CORS_ORIGIN など）は Worker の vars に置き、ここでは宣言しない。
// 公開リポジトリなので、実際に使える値やdefaultを書かない。値は「未設定」「16文字未満」「-change-me で終わる値」を実行時に拒否する。
export default defineEnv({
  // パスワード認証で資格情報のhashへ加える秘密値。登録後は変更しない。
  PEPPER_SECRET: string().optional(),
  // 機械credentialのaccess tokenの署名鍵。
  JWT_SECRET: string(),
  // 監査イベントの識別子 HMAC 用。
  AUDIT_HMAC_SECRET: string(),
  // 添付の DEK を包む KEK。{"version": "base64 32 バイト"} 形式で、最大 version が現行鍵。未設定なら添付 API は 503 を返す。
  ATTACHMENT_KEKS: string().optional(),
  // OIDCのclient secret。SIGN_IN_METHOD=oidc でconfidential clientを使うときだけ設定する。
  OIDC_CLIENT_SECRET: string().optional(),
  // 外部access tokenの検証鍵（JWK set の JSON）。
  IDENTITY_JWKS: string().optional(),
  // 初期 ROOT の作成と、パスキーを失くしたときの復旧だけに設定し、使い終えたら削除する。
  // 未設定なら POST /api/system/bootstrap と POST /api/system/passkey-recoveries は 404。
  BOOTSTRAP_TOKEN: string().optional(),
})
