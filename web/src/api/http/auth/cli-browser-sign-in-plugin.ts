import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { jwtVerify } from "jose"
import { z } from "zod"
import { CLI_BROWSER_CALLBACK_PATH, CLI_BROWSER_CODE_PATH } from "./auth-session-method.ts"
import { ensureAuthUser } from "./ensure-auth-user.ts"
import { discoverOidcProvider, type OidcProviderMetadata } from "./oidc-provider.ts"
import { isSecureOidcUrl } from "./sign-in-method.ts"

const CODE_LIFETIME_SECONDS = 60
const VERIFICATION_PREFIX = "cli-browser-sign-in:"

const pendingSchema = z.object({ accountId: z.string().min(1), email: z.string().nullable() })
const accessTokenClaimsSchema = z.object({ sub: z.string().min(1).max(255) })

type Options = Readonly<{
  env: Readonly<Record<string, unknown>>
  database: () => D1Database
  /** テストで発行者のdiscoveryを差し替える。 */
  discover?: (issuer: string) => Promise<Pick<OidcProviderMetadata, "issuer" | "algorithms" | "keys"> | Error>
}>

/**
 * CLIでサインイン済みの本人を、ブラウザへ引き継ぐ。
 *
 * - `POST /cli/browser-code`: CLIが持つBase宛てのaccess token（Bearer）を検証し、
 *   一度だけ使える短命のcodeを返す。tokenそのものはブラウザへ渡さない。
 * - `GET /cli/callback?code=`: codeをBetter Authのセッションへ交換してトップへ戻す。
 *
 * セッションは委任として扱い、直前の本人確認（承認や再認証）には使わせない。
 */
export function cliBrowserSignIn(options: Options) {
  const discover =
    options.discover ??
    ((issuer: string) =>
      discoverOidcProvider({ issuer, clientId: "", clientSecret: null, excludedAudiences: [] }))

  return {
    id: "cli-browser-sign-in",
    endpoints: {
      cliBrowserCode: createAuthEndpoint(
        CLI_BROWSER_CODE_PATH,
        { method: "POST", requireHeaders: true },
        async (ctx) => {
          const token = readBearer(ctx.headers?.get("authorization") ?? null)
          if (token === null) throw APIError.from("UNAUTHORIZED", invalidToken)
          const issuer = text(options.env.IDENTITY_ACCESS_TOKEN_ISSUER)
          const audience = text(options.env.IDENTITY_ACCESS_TOKEN_AUDIENCE)
          if (issuer === null || audience === null || !isSecureOidcUrl(new URL(issuer))) {
            throw APIError.from("SERVICE_UNAVAILABLE", unavailable)
          }
          const provider = await discover(issuer)
          if (provider instanceof Error) throw APIError.from("SERVICE_UNAVAILABLE", unavailable)
          const subject = await verifyAccessToken(token, provider, audience)
          if (subject === null) throw APIError.from("UNAUTHORIZED", invalidToken)

          const { findSystemOidcSignInAccount } =
            await import("@system/interface/operations/find-system-oidc-sign-in-account")
          const account = await findSystemOidcSignInAccount(
            { env: { DB: options.database() } },
            subject,
          )
          if (account instanceof Error) throw APIError.from("SERVICE_UNAVAILABLE", unavailable)
          if (account === null) throw APIError.from("UNAUTHORIZED", invalidToken)

          const code = randomToken()
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${VERIFICATION_PREFIX}${code}`,
            value: JSON.stringify({ accountId: account.accountId, email: account.email }),
            expiresAt: new Date(Date.now() + CODE_LIFETIME_SECONDS * 1_000),
          })
          return ctx.json({ code, expires_in: CODE_LIFETIME_SECONDS })
        },
      ),
      cliBrowserCallback: createAuthEndpoint(
        CLI_BROWSER_CALLBACK_PATH,
        { method: "GET", query: z.object({ code: z.string().min(1).max(256) }) },
        async (ctx) => {
          const verification = await ctx.context.internalAdapter.consumeVerificationValue(
            `${VERIFICATION_PREFIX}${ctx.query.code}`,
          )
          const pending = verification === null ? null : readPending(verification.value)
          if (pending === null || verification === null || verification.expiresAt < new Date()) {
            throw ctx.redirect(signInErrorUrl("invalid_state"))
          }

          // Accountの停止やIdentityの失効は、セッション作成のhookがtoken版の照合で拒否する。
          const account = pending
          await ensureAuthUser(ctx, account)
          const user = await ctx.context.internalAdapter.findUserById(account.accountId)
          // 認証方式とtoken版はセッション作成のhookが記録する。条件を満たさなければ作らない。
          const session = await ctx.context.internalAdapter
            .createSession(account.accountId, false)
            .catch(() => null)
          if (user === null || session === null) throw ctx.redirect(signInErrorUrl("no_account"))
          await setSessionCookie(ctx, { session, user })
          throw ctx.redirect("/")
        },
      ),
    },
  } satisfies BetterAuthPlugin
}

async function verifyAccessToken(
  token: string,
  provider: Pick<OidcProviderMetadata, "issuer" | "algorithms" | "keys">,
  audience: string,
): Promise<string | null> {
  try {
    const verified = await jwtVerify(token, provider.keys, {
      algorithms: [...provider.algorithms],
      issuer: provider.issuer,
      audience,
      requiredClaims: ["exp", "sub"],
    })
    const claims = accessTokenClaimsSchema.safeParse(verified.payload)
    return claims.success ? claims.data.sub : null
  } catch {
    return null
  }
}

function readBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S{1,8192})$/i)
  return match?.[1] ?? null
}

function readPending(value: string): z.infer<typeof pendingSchema> | null {
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

function signInErrorUrl(reason: string): string {
  return `/sign-in?error=${reason}`
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const invalidToken = { code: "INVALID_CLI_TOKEN", message: "sign in with the CLI again" }
const unavailable = { code: "AUTH_UNAVAILABLE", message: "authentication unavailable" }
