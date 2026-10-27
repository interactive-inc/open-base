import type { BetterAuthPlugin } from "better-auth"
import { createAuthEndpoint } from "better-auth/api"
import { expireCookie, setSessionCookie } from "better-auth/cookies"
import { z } from "zod"
import { OIDC_CALLBACK_PATH } from "./auth-session-method.ts"
import { ensureAuthUser } from "./ensure-auth-user.ts"
import { sameOriginPath } from "./same-origin-path.ts"
import { discoverOidcProvider, exchangeOidcCode, verifyOidcIdToken } from "./oidc-provider.ts"
import { readOidcConfiguration } from "./sign-in-method.ts"

const STATE_LIFETIME_SECONDS = 10 * 60
const STATE_COOKIE = "oidc_state"
const VERIFICATION_PREFIX = "oidc-sign-in:"

const pendingSchema = z.object({
  codeVerifier: z.string().min(43),
  nonce: z.string().min(1),
  callbackURL: z.string(),
  requireFreshSignIn: z.boolean(),
  startedAt: z.number().int().nonnegative(),
})

type Options = Readonly<{
  env: Readonly<Record<string, unknown>>
  database: () => D1Database
}>

/**
 * 外部のOIDC発行者でサインインする。認可code、PKCE、nonce、stateを使う標準の流れで、
 * ID tokenのsubjectに結び付いた有効なIdentityを持つSystem Accountだけをサインインさせる。
 *
 * - `GET /oidc/sign-in`: 発行者の認可endpointへ移る。`prompt=login` で再認証として始め、
 *   発行者が対応していればIdPに認証し直しを求める。
 * - `GET /oidc/callback`: codeをID tokenへ交換し、Better Authのセッションを作る。
 *
 * stateはこのブラウザの署名付きcookieとDBの両方で照合し、一度だけ使える。
 */
export function oidcSignIn(options: Options) {
  return {
    id: "oidc-sign-in",
    endpoints: {
      oidcSignIn: createAuthEndpoint(
        "/oidc/sign-in",
        {
          method: "GET",
          query: z.object({
            callbackURL: z.string().max(2_048).optional(),
            prompt: z.literal("login").optional(),
          }),
        },
        async (ctx) => {
          const configuration = readOidcConfiguration(options.env)
          if (configuration === null) throw ctx.redirect(signInErrorUrl("unavailable"))
          const provider = await discoverOidcProvider(configuration)
          if (provider instanceof Error) throw ctx.redirect(signInErrorUrl("unavailable"))

          const state = randomToken()
          const nonce = randomToken()
          const codeVerifier = randomToken()
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${VERIFICATION_PREFIX}${state}`,
            value: JSON.stringify({
              codeVerifier,
              nonce,
              callbackURL: sameOriginPath(ctx.query.callbackURL),
              requireFreshSignIn: ctx.query.prompt === "login",
              startedAt: Math.floor(Date.now() / 1_000) * 1_000,
            }),
            expiresAt: new Date(Date.now() + STATE_LIFETIME_SECONDS * 1_000),
          })
          const cookie = ctx.context.createAuthCookie(STATE_COOKIE, {
            maxAge: STATE_LIFETIME_SECONDS,
          })
          await ctx.setSignedCookie(cookie.name, state, ctx.context.secret, cookie.attributes)

          const url = new URL(provider.authorizationEndpoint)
          url.searchParams.set("response_type", "code")
          url.searchParams.set("client_id", configuration.clientId)
          url.searchParams.set("redirect_uri", callbackUrl(ctx.context.baseURL))
          url.searchParams.set("scope", "openid email profile")
          url.searchParams.set("state", state)
          url.searchParams.set("nonce", nonce)
          url.searchParams.set("code_challenge", await codeChallenge(codeVerifier))
          url.searchParams.set("code_challenge_method", "S256")
          // 対応していない発行者へ送ると認可が失敗するので、宣言があるときだけ送る。
          if (ctx.query.prompt === "login") {
            // 再認証では、IdPに残ったログインを使わず本人に認証し直してもらう。
            if (provider.supportsLoginPrompt) url.searchParams.set("prompt", "login")
            url.searchParams.set("max_age", "0")
          }
          throw ctx.redirect(url.toString())
        },
      ),
      oidcCallback: createAuthEndpoint(
        OIDC_CALLBACK_PATH,
        {
          method: "GET",
          query: z.object({
            code: z.string().max(4_096).optional(),
            state: z.string().max(256).optional(),
            iss: z.string().max(2_048).optional(),
            error: z.string().max(256).optional(),
          }),
        },
        async (ctx) => {
          const cookie = ctx.context.createAuthCookie(STATE_COOKIE)
          const cookieState = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
          expireCookie(ctx, cookie)
          const { code, state, iss, error } = ctx.query
          if (error !== undefined) throw ctx.redirect(signInErrorUrl("denied"))
          if (code === undefined || state === undefined || cookieState !== state) {
            throw ctx.redirect(signInErrorUrl("invalid_state"))
          }
          const verification = await ctx.context.internalAdapter.consumeVerificationValue(
            `${VERIFICATION_PREFIX}${state}`,
          )
          const pending = verification === null ? null : readPending(verification.value)
          if (pending === null) throw ctx.redirect(signInErrorUrl("invalid_state"))

          const configuration = readOidcConfiguration(options.env)
          if (configuration === null) throw ctx.redirect(signInErrorUrl("unavailable"))
          // 発行者を示す応答なら、別の発行者からの応答を混ぜさせない。
          if (iss !== undefined && iss !== configuration.issuer) {
            throw ctx.redirect(signInErrorUrl("invalid_state"))
          }
          const provider = await discoverOidcProvider(configuration)
          if (provider instanceof Error) throw ctx.redirect(signInErrorUrl("unavailable"))
          const idToken = await exchangeOidcCode({
            configuration,
            provider,
            code,
            codeVerifier: pending.codeVerifier,
            redirectUri: callbackUrl(ctx.context.baseURL),
          })
          if (idToken instanceof Error) throw ctx.redirect(signInErrorUrl("failed"))
          const now = new Date()
          const claims = await verifyOidcIdToken({
            token: idToken,
            configuration,
            provider,
            nonce: pending.nonce,
            now,
          })
          if (claims === null) throw ctx.redirect(signInErrorUrl("failed"))
          if (
            pending.requireFreshSignIn &&
            (claims.authenticatedAt === null ||
              claims.authenticatedAt.getTime() < pending.startedAt ||
              now.getTime() - claims.authenticatedAt.getTime() > 5 * 60 * 1_000)
          ) {
            throw ctx.redirect(signInErrorUrl("failed"))
          }

          const { findSystemOidcSignInAccount } =
            await import("@system/interface/operations/find-system-oidc-sign-in-account")
          const account = await findSystemOidcSignInAccount(
            { env: { DB: options.database() } },
            claims.subject,
          )
          if (account instanceof Error) throw ctx.redirect(signInErrorUrl("unavailable"))
          if (account === null) throw ctx.redirect(signInErrorUrl("no_account"))

          await ensureAuthUser(ctx, account)
          const user = await ctx.context.internalAdapter.findUserById(account.accountId)
          const authenticatedAt = claims.authenticatedAt
          // 認証方式とtoken版はセッション作成のhookが記録する。条件を満たさなければ作らない。
          const session = await ctx.context.internalAdapter
            .createSession(account.accountId, false, {
              authenticatedAt:
                authenticatedAt === null
                  ? undefined
                  : Math.min(authenticatedAt.getTime(), now.getTime()),
            })
            .catch(() => null)
          if (user === null || session === null) throw ctx.redirect(signInErrorUrl("no_account"))
          await setSessionCookie(ctx, { session, user })
          throw ctx.redirect(pending.callbackURL)
        },
      ),
    },
  } satisfies BetterAuthPlugin
}

function readPending(value: string): z.infer<typeof pendingSchema> | null {
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function callbackUrl(baseURL: string): string {
  return `${baseURL.replace(/\/$/, "")}${OIDC_CALLBACK_PATH}`
}

function signInErrorUrl(reason: string): string {
  return `/sign-in?error=${reason}`
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return base64Url(bytes)
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

function base64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
