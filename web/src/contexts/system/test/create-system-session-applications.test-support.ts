import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemSignedInSession } from "@system/interface/request-environment/system-signed-in-session-channel"
import { SystemSignedInSessionChannel } from "@system/interface/request-environment/system-signed-in-session-channel"
import { generateOpaqueToken } from "@system/lib/auth/generate-opaque-token"
import type { MiddlewareHandler } from "hono"

type Props = Readonly<{
  context: SystemD1Context
  sessionTtlMilliseconds?: number
}>

type IssueCommand = Readonly<{
  accountId: string
  tokenVersion: number
  now: Date
  auditContext?: unknown
  method?: SystemSignedInSession["method"]
  authenticatedAt?: Date
}>

export type SystemTestSessionIssuance =
  | Readonly<{ kind: "issued"; accessToken: string; session: SystemSignedInSession }>
  | Readonly<{ kind: "rejected" }>

export type SystemSessionApplications = Readonly<{
  issue: Readonly<{ execute: (command: IssueCommand) => Promise<SystemTestSessionIssuance> }>
}>

/** testで発行したtokenと、それに対応するサインイン済みセッション。 */
const sessions = new Map<string, SystemSignedInSession>()

/**
 * Better Authのセッションの代わりに、testで使うサインイン済みセッションを発行する。
 * 本番は製品のcompositionがBetter Authで検証したセッションをSystemへ渡す。testでは
 * `systemTestSignedInSession` middlewareがBearerのtest tokenを同じ形でSystemへ渡す。
 */
export function createSystemSessionApplications(props: Props): SystemSessionApplications {
  const ttl = props.sessionTtlMilliseconds ?? 604_800_000
  return Object.freeze({
    issue: Object.freeze({
      execute: async (command: IssueCommand): Promise<SystemTestSessionIssuance> => {
        const accessToken = `test-session.${generateOpaqueToken()}`
        const authenticatedAt = command.authenticatedAt ?? command.now
        const session: SystemSignedInSession = Object.freeze({
          accountId: command.accountId,
          sessionId: crypto.randomUUID(),
          authenticatedAt,
          expiresAt: new Date(authenticatedAt.getTime() + ttl),
          method: command.method ?? "passkey",
          accountTokenVersion: command.tokenVersion,
        })
        sessions.set(accessToken, session)
        return Object.freeze({ kind: "issued" as const, accessToken, session })
      },
    }),
  })
}

/**
 * Bearerがtestで発行したtokenなら、そのセッションをenvの複製へ結び付ける。
 * それ以外のBearer（外部access token、機械credentialのtoken）はそのまま後段へ渡す。
 */
export const systemTestSignedInSession: MiddlewareHandler = async (context, next) => {
  const header = context.req.header("authorization")
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null
  const session = token === null ? undefined : sessions.get(token)
  if (session !== undefined) {
    context.env = new SystemSignedInSessionChannel({ env: context.env as object }).attach(session)
    const headers = new Headers(context.req.raw.headers)
    headers.delete("authorization")
    context.req.raw = new Request(context.req.raw, { headers })
  }
  await next()
}
