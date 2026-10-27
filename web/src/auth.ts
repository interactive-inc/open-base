import { isEnabledAuthPath, requiresCurrentSession } from "./api/http/auth/auth-path-policy.ts"
import { preparePasswordSignIn } from "./api/http/auth/prepare-password-sign-in.ts"
import { hashPassword } from "./contexts/system/lib/auth/hash-password.ts"
import { verifyPassword } from "./contexts/system/lib/auth/verify-password.ts"
import { passkey } from "@better-auth/passkey"
import { bearer, deviceAuthorization } from "better-auth/plugins"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { defineAuth } from "void/auth"
import {
  BASE_CLI_CLIENT_ID,
  isFreshSignInSession,
  readAuthSessionMethod,
} from "./api/http/auth/auth-session-method.ts"
import { ensureAuthUser } from "./api/http/auth/ensure-auth-user.ts"
import { oidcSignIn } from "./api/http/auth/oidc-sign-in-plugin.ts"
import { readSignInMethod } from "./api/http/auth/sign-in-method.ts"

/**
 * 人のサインインは、配備ごとに `SIGN_IN_METHOD` で選んだパスワード・パスキー・OIDCのいずれか一つで行う。
 * パスワード資格情報の正本はSystemに置く。選ばなかった方式のendpointは使わせない。
 *
 * - Better AuthのユーザーIDはSystem AccountのIDと同じ値にする。ユーザーはSystemが本人と
 *   確かめたとき（パスキー招待の登録か、OIDCのsubjectに結び付いたIdentity）だけ作る。
 * - CLIとMCPはデバイス認証で得たセッションtokenをBearerで送る。
 * - セッションには発行時のAccountのtoken版と認証方式を残し、APIが毎回Accountの現在状態と照合する。
 *
 * Voidはこのfileを設定とtable定義を読むためにNodeでも読み込む。Nodeではpathの別名を解決しないため、
 * Systemの処理は使うときにだけ読み込む。tableの名前はBetter Authの既定のまま使う。Voidが生成する
 * Drizzle schemaは既定の名前を前提にしている。
 */
export default defineAuth(({ defaults, env }) => {
  // table定義だけを読むときはD1が無いので、使うときに取り出す。
  const database = () => readDatabase(env)
  const signInMethod = readSignInMethod(env)
  const pepper =
    typeof env.PEPPER_SECRET === "string" && env.PEPPER_SECRET.length >= 16
      ? env.PEPPER_SECRET
      : null

  return {
    ...defaults,
    appName: "Base",
    emailAndPassword: {
      enabled: signInMethod === "password",
      disableSignUp: true,
      password: {
        hash: (password) => {
          if (pepper === null) throw new Error("password authentication is not configured")
          return hashPassword(password, pepper)
        },
        verify: ({ hash, password }) =>
          pepper === null ? Promise.resolve(false) : verifyPassword(password, hash, pepper),
      },
    },
    session: {
      additionalFields: {
        accountTokenVersion: { type: "number", required: false, input: false },
        authenticationMethod: { type: "string", required: false, input: false },
        authenticatedAt: { type: "number", required: false, input: false },
      },
    },
    rateLimit: { ...defaults.rateLimit, storage: "database" },
    advanced: {
      ...defaults.advanced,
      database: { generateId: () => crypto.randomUUID() },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!isEnabledAuthPath(ctx.path, signInMethod)) throw APIError.from("NOT_FOUND", disabled)
        if (requiresCurrentSession(ctx.path)) {
          const state = await getSessionFromCtx(ctx)
          if (state !== null) {
            const { readSystemAccountTokenVersion } =
              await import("@system/interface/operations/read-system-account-token-version")
            const version =
              signInMethod === null
                ? null
                : await readSystemAccountTokenVersion(
                    { env: { DB: database() } },
                    state.session.userId,
                    signInMethod,
                  )
            if (version instanceof Error)
              throw APIError.from("SERVICE_UNAVAILABLE", {
                code: "AUTH_UNAVAILABLE",
                message: "authentication unavailable",
              })
            if (
              version === null ||
              version !== state.session.accountTokenVersion ||
              (state.session.authenticationMethod !== "device" &&
                state.session.authenticationMethod !== signInMethod)
            )
              throw APIError.from("UNAUTHORIZED", {
                code: "SESSION_REVOKED",
                message: "sign in again",
              })
            if (
              ctx.path.startsWith("/passkey/") &&
              ctx.path !== "/passkey/list-user-passkeys" &&
              !isFreshSignInSession(state.session, new Date())
            ) {
              throw APIError.from("FORBIDDEN", freshSignInRequired)
            }
          }
        }
        if (ctx.path === "/sign-in/email") {
          if (pepper === null)
            throw APIError.from("SERVICE_UNAVAILABLE", {
              code: "AUTH_UNAVAILABLE",
              message: "authentication unavailable",
            })
          const body: unknown = ctx.body
          if (
            typeof body === "object" &&
            body !== null &&
            "email" in body &&
            typeof body.email === "string"
          ) {
            const email = body.email.trim().toLowerCase()
            await preparePasswordSignIn(database(), ctx.context.adapter, email)
            return { context: { body: { ...body, email } } }
          }
        }
        // CLIとMCPへの権限の受け渡しは、直前にサインインした本人だけが承認できる。
        if (ctx.path !== "/device/approve") return
        const state = await getSessionFromCtx(ctx)
        if (state === null || !isFreshSignInSession(state.session, new Date())) {
          throw APIError.from("FORBIDDEN", freshSignInRequired)
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // ユーザーはSystemで本人を確認した経路からだけ、Account IDを指定して作る。
          before: async () => false,
        },
      },
      session: {
        create: {
          before: async (session, context) => {
            const method = readAuthSessionMethod(context?.path)
            if (method === null || signInMethod === null) return false
            if (method !== "device" && method !== signInMethod) return false
            const { readSystemAccountTokenVersion } =
              await import("@system/interface/operations/read-system-account-token-version")
            // デバイス認証のセッションは、承認した本人がこの配備の方式でサインインできるかで照合する。
            const tokenVersion = await readSystemAccountTokenVersion(
              { env: { DB: database() } },
              session.userId,
              signInMethod,
            )
            if (tokenVersion === null || tokenVersion instanceof Error) return false
            if (method === "password") {
              const body: unknown = context?.body
              if (
                pepper === null ||
                typeof body !== "object" ||
                body === null ||
                !("email" in body) ||
                typeof body.email !== "string" ||
                !("password" in body) ||
                typeof body.password !== "string"
              )
                return false
              const { findSystemPasswordSignInAccount } =
                await import("@system/interface/operations/find-system-password-sign-in-account")
              const credential = await findSystemPasswordSignInAccount(
                { env: { DB: database() } },
                { email: body.email, now: new Date() },
              )
              // 最初の照合中に資格情報が変わっても、古いパスワードへ新しい版のセッションを渡さない。
              if (
                credential === null ||
                credential instanceof Error ||
                credential.accountId !== session.userId ||
                !(await verifyPassword(body.password, credential.passwordHash, pepper))
              )
                return false
            }
            return {
              data: { ...session, accountTokenVersion: tokenVersion, authenticationMethod: method },
            }
          },
        },
      },
    },
    plugins: [
      ...(defaults.plugins ?? []),
      bearer(),
      deviceAuthorization({
        verificationUri: "/device",
        validateClient: (clientId) => clientId === BASE_CLI_CLIENT_ID,
      }),
      oidcSignIn({ env, database }),
      passkey({
        rpName: "Base",
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        authentication: {
          afterVerification: async ({ verification }) => {
            if (!verification.authenticationInfo.userVerified)
              throw APIError.from("UNAUTHORIZED", userVerificationRequired)
          },
        },
        registration: {
          // 招待tokenをcontextで受け取り、サインイン前のパスキー登録を許す。
          requireSession: false,
          resolveUser: async ({ context }) => {
            const { findSystemPasskeyEnrollment } =
              await import("@system/interface/operations/find-system-passkey-enrollment")
            const enrollment = await findSystemPasskeyEnrollment(
              { env: { DB: database() } },
              { token: context ?? "", now: new Date() },
            )
            if (enrollment instanceof Error)
              throw APIError.from("INTERNAL_SERVER_ERROR", unavailable)
            if (enrollment === null) throw APIError.from("BAD_REQUEST", invalidEnrollment)
            return { id: enrollment.accountId, name: enrollment.email }
          },
          afterVerification: async ({ ctx, user, context, verification }) => {
            if (!verification.registrationInfo?.userVerified)
              throw APIError.from("BAD_REQUEST", userVerificationRequired)
            // サインイン済みの本人が追加するパスキーは、招待なしで登録できる。
            if (context === null || context === undefined) return { userId: user.id }
            const { completeSystemPasskeyEnrollment } =
              await import("@system/interface/operations/complete-system-passkey-enrollment")
            const enrollment = await completeSystemPasskeyEnrollment(
              { env: { DB: database() } },
              { token: context, now: new Date() },
            )
            if (enrollment instanceof Error)
              throw APIError.from("INTERNAL_SERVER_ERROR", unavailable)
            if (enrollment === null || enrollment.accountId !== user.id) {
              throw APIError.from("BAD_REQUEST", invalidEnrollment)
            }
            await ensureAuthUser(ctx, enrollment)
            // 招待による復旧は鍵の置き換え。紛失した鍵をサインインに使い続けられないようにする。
            await ctx.context.adapter.deleteMany({
              model: "passkey",
              where: [{ field: "userId", value: enrollment.accountId }],
            })
            return { userId: enrollment.accountId }
          },
        },
      }),
    ],
  }
})

const userVerificationRequired = {
  code: "USER_VERIFICATION_REQUIRED",
  message: "verify your identity with the authenticator",
}

const freshSignInRequired = {
  code: "FRESH_SIGN_IN_REQUIRED",
  message: "sign in again before approving",
}
const disabled = { code: "SIGN_IN_METHOD_DISABLED", message: "not found" }

const invalidEnrollment = { code: "INVALID_PASSKEY_ENROLLMENT", message: "invalid enrollment" }
const unavailable = { code: "PASSKEY_ENROLLMENT_UNAVAILABLE", message: "enrollment unavailable" }

function readDatabase(env: Record<string, unknown>): D1Database {
  const database = env.DB
  if (typeof database !== "object" || database === null || !("prepare" in database)) {
    throw new Error("auth: D1 binding DB is missing")
  }
  return database as D1Database
}
