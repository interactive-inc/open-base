import { passkey } from "@better-auth/passkey"
import { bearer, deviceAuthorization } from "better-auth/plugins"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { defineAuth } from "void/auth"
import {
  BASE_CLI_CLIENT_ID,
  isFreshPasskeySession,
  readAuthSessionMethod,
} from "./api/http/auth/auth-session-method.ts"

/**
 * 認証はBetter Authのパスキーだけで行う。パスワードと外部IdPのログインは持たない。
 *
 * - Better AuthのユーザーIDはSystem AccountのIDと同じ値にする。ユーザーはSystemが発行した
 *   パスキー招待を使って登録したときだけ作る。
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

  return {
    ...defaults,
    appName: "Base",
    emailAndPassword: { enabled: false },
    session: {
      additionalFields: {
        accountTokenVersion: { type: "number", required: false, input: false },
        authenticationMethod: { type: "string", required: false, input: false },
      },
    },
    rateLimit: { ...defaults.rateLimit, storage: "database" },
    advanced: {
      ...defaults.advanced,
      database: { generateId: () => crypto.randomUUID() },
    },
    hooks: {
      // CLIとMCPへの権限の受け渡しは、直前にパスキーでサインインした本人だけが承認できる。
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/device/approve") return
        const state = await getSessionFromCtx(ctx)
        if (state === null || !isFreshPasskeySession(state.session, new Date())) {
          throw APIError.from("FORBIDDEN", freshPasskeyRequired)
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // ユーザーはパスキー招待の完了時にだけ、Account IDを指定して作る。
          before: async () => false,
        },
      },
      session: {
        create: {
          before: async (session, context) => {
            const method = readAuthSessionMethod(context?.path)
            if (method === null) return false
            const { readSystemAccountTokenVersion } =
              await import("@system/interface/operations/read-system-account-token-version")
            const tokenVersion = await readSystemAccountTokenVersion(
              { env: { DB: database() } },
              session.userId,
            )
            if (tokenVersion === null || tokenVersion instanceof Error) return false
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
      passkey({
        rpName: "Base",
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
          afterVerification: async ({ ctx, user, context }) => {
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
            const existing = await ctx.context.internalAdapter.findUserById(enrollment.accountId)
            if (existing === null) {
              const now = new Date()
              await ctx.context.adapter.create({
                model: "user",
                forceAllowId: true,
                data: {
                  id: enrollment.accountId,
                  email: enrollment.email,
                  name: enrollment.email,
                  emailVerified: true,
                  createdAt: now,
                  updatedAt: now,
                },
              })
            }
            return { userId: enrollment.accountId }
          },
        },
      }),
    ],
  }
})

const freshPasskeyRequired = {
  code: "FRESH_PASSKEY_REQUIRED",
  message: "sign in with a passkey again before approving",
}
const invalidEnrollment = { code: "INVALID_PASSKEY_ENROLLMENT", message: "invalid enrollment" }
const unavailable = { code: "PASSKEY_ENROLLMENT_UNAVAILABLE", message: "enrollment unavailable" }

function readDatabase(env: Record<string, unknown>): D1Database {
  const database = env.DB
  if (typeof database !== "object" || database === null || !("prepare" in database)) {
    throw new Error("auth: D1 binding DB is missing")
  }
  return database as D1Database
}
