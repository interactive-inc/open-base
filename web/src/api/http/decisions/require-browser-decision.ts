import type { HonoEnv } from "@/bindings"
import { SystemServiceBindingAccountChannel } from "@system/interface/request-environment/system-service-binding-account-channel"
import { SystemSignedInSessionChannel } from "@system/interface/request-environment/system-signed-in-session-channel"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"

/** 判断の画面がある対象と、その画面の経路。 */
const decisionPagePaths = {
  application: "/decisions/applications",
  review_sheet: "/decisions/reviews",
} as const

export type DecisionPageKind = keyof typeof decisionPagePaths

/** 判断を記録せずに、判断の画面のURLを返すときの応答のcode。 */
export const DECISION_REQUIRES_BROWSER_CODE = "decision_requires_browser"

/**
 * 承認・却下・差し戻しを、人がブラウザーでサインインした画面からの要求に限る。
 *
 * 受け付けるのは、パスワード・パスキー・OIDCで作ったセッションが、同じoriginの画面から送った要求だけ。
 * デバイス認証のセッション（CLIとMCP、CLIから引き継いだブラウザー）、外部access token、機械credential、
 * Service Bindingの主体は判断を記録できない。その場合は拒否だけで終わらせず、判断の画面のURLを返す。
 * `Sec-Fetch-Site` はブラウザーだけが付け、画面のscriptから書き換えられないので、別のsiteからの要求も弾ける。
 */
export function requireBrowserDecision(
  c: Context<HonoEnv>,
  kind: DecisionPageKind,
  id: string,
): void {
  const serviceBinding = new SystemServiceBindingAccountChannel({ env: c.env }).read()
  const session = new SystemSignedInSessionChannel({ env: c.env }).read()
  const signedInByPerson =
    serviceBinding === null &&
    session !== null &&
    (session.method === "password" || session.method === "passkey" || session.method === "oidc")
  if (signedInByPerson && c.req.header("sec-fetch-site") === "same-origin") return

  const decisionUrl = new URL(
    `${decisionPagePaths[kind]}/${encodeURIComponent(id)}`,
    new URL(c.req.url).origin,
  )
  throw new HTTPException(403, {
    res: Response.json(
      {
        error: "decisions are made on the decision page in a browser",
        code: DECISION_REQUIRES_BROWSER_CODE,
        decision_url: decisionUrl.toString(),
      },
      { status: 403 },
    ),
  })
}
