import { z } from "zod"

export const zAppMcpGrantResponse = z.object({
  item: z.object({ grant: z.string() }).nullable(),
  error: z.string().optional(),
})

/** 副作用の完了だけを伝える応答。パスワード変更・再設定受付が使う。 */
export const zAppAuthAcknowledgement = z.object({
  item: z.object({ ok: z.literal(true) }),
})

/**
 * ログアウトの応答。switchedTo は残アカウントへ切り替わったときだけ true、
 * 完全ログアウト時は null 。
 */
export const zAppLogoutResponse = z.object({
  item: z.object({
    ok: z.literal(true),
    switchedTo: z.literal(true).nullable(),
  }),
})

export const zAppOidcAuthorizationResponse = z.strictObject({
  redirect_uri: z.url(),
})
