import { guardBootstrapSignInMethod } from "@/api/http/auth/guard-bootstrap-sign-in-method"
import { authenticateSystemBearer } from "@/api/http/authenticate-system-bearer"
import { HTTPException } from "hono/http-exception"
import { handleApiError } from "@/api/error-response/handle-api-error"
import { companyValidationErrorMiddleware } from "@/api/http/company-validation-error-middleware"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { contextStorage } from "hono/context-storage"
import { databaseMiddleware } from "@/api/database-middleware"
import { featureGate } from "@/api/http/middlewares/feature-gate"
import { rateLimitMiddleware } from "@/api/http/middlewares/rate-limit-middleware"
import { readOnlyModeMiddleware } from "@/api/http/middlewares/read-only-mode-middleware"
import { requestContextMiddleware } from "@/api/http/middlewares/request-context-middleware"
import { factory } from "@/api/http/factory"
import { auditNoStore } from "@/api/http/middlewares/audit-no-store"
import { verifyBearer } from "@/api/http/verify-bearer"
import {
  CompanyActorValue,
  type CompanyCapability,
} from "@/contexts/company/domain/values/company-actor.value"
import { toCompanyActorGrants } from "@/api/http/company/to-company-actor-grants"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** CORS_ORIGIN 未設定時に許可するローカル開発用 Origin。 */
const defaultAllowedOrigins = [
  "https://app.base.localhost",
  "http://localhost:3000",
  "http://localhost:5173",
]

let corsWarningLogged = false

/**
 * Origin リクエストヘッダを env.CORS_ORIGIN（カンマ区切り）と照合し、許可された Origin のみ返す。
 * 未設定時は defaultAllowedOrigins のみ許可し、セキュリティ警告をログに出す。
 * 本番では必ず CORS_ORIGIN を設定すること。
 */
function resolveAllowedOrigin(origin: string, allowList: string | undefined): string | null {
  if (allowList === undefined || allowList.trim() === "") {
    if (!corsWarningLogged) {
      corsWarningLogged = true
      console.warn(
        "[SECURITY] CORS_ORIGIN is not set — falling back to localhost origins. " +
          "Set CORS_ORIGIN in production to restrict cross-origin access.",
      )
    }
    return defaultAllowedOrigins.includes(origin) ? origin : null
  }

  const allowed = allowList
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return allowed.includes(origin) ? origin : null
}

let nowProductionGuardWarned = false
const nowProductionGuardMiddleware = factory.createMiddleware(async (c, next) => {
  if (!nowProductionGuardWarned && c.env.CORS_ORIGIN !== undefined && c.env.NOW !== undefined) {
    nowProductionGuardWarned = true
    console.warn("[SECURITY] NOW override is set in production — this affects all timestamps")
  }
  await next()
})

const systemContextMiddleware = factory.createMiddleware(async (c, next) => {
  c.set("now", () => new Date(c.env.NOW ?? Date.now()))
  c.set("companyClock", () => new Date(c.env.NOW ?? Date.now()))
  await next()
})

const globalBodyLimit = bodyLimit({ maxSize: 1_000_000 })

const globalBodyLimitExceptAuditExport = factory.createMiddleware(async (c, next) => {
  if (c.req.path === "/company/audit-event-exports") {
    await next()
    return
  }

  await globalBodyLimit(c, next)
})

const companyActorMiddleware = factory.createMiddleware(async (c, next) => {
  const session = c.var.session
  if (!session) throw new HTTPException(401, { message: "authentication required" })

  const { capabilities, permissions } = toCompanyActorGrants((permission) =>
    session.hasPermission(permission),
  )

  c.set(
    "companyActor",
    CompanyActorValue.restore({
      accountId: String(session.accountId),
      employeeId: session.employeeId === null ? null : String(session.employeeId),
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities,
      permissions,
    }),
  )
  await next()
})

/** 初期化はSystem認証、外部同期は共有handlerの機械認証、通常操作は従業員sessionを要求する。 */
const companyAuthenticationMiddleware = factory.createMiddleware(async (c, next) => {
  if (c.req.path === "/company/bootstrap" && c.req.method === "POST") {
    await authenticateSystemBearer(c)
    const capabilities: CompanyCapability[] = []
    if (c.var.permissions.has("system:admin")) capabilities.push("company:admin")
    c.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: String(c.var.userId),
        employeeId: null,
        organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
        capabilities,
      }),
    )
    await next()
    return
  }
  if (c.req.path === "/company/external-identity-imports" && c.req.method === "POST") {
    await next()
    return
  }
  await verifyBearer(c, async () => {
    await companyActorMiddleware(c, next)
  })
})

/**
 * 全ルート共通の土台。middleware・エラーハンドラだけを持ち、context routeは載せない。
 * context routeの登録は生成物である app.ts と runtime-app.ts が行う（`bun run gen:app`）。
 * 両者が同じ土台を共有して二重登録しないよう、呼び出しごとに新しいappを作る。
 *
 * このファイルは手で編集する。app.ts と分けているのは、生成器が
 * middleware 定義やエラーハンドラの本文を文字列として抱え込まないようにするため。
 */
export function createAppBase() {
  return (
    factory
      .createApp()
      .use("*", requestContextMiddleware)
      .use("*", companyValidationErrorMiddleware())
      .use("*", auditNoStore)
      .use(
        "*",
        cors({
          origin: (origin, c) => resolveAllowedOrigin(origin, c.env.CORS_ORIGIN),
          exposeHeaders: ["X-Request-ID", "Content-Disposition"],
        }),
      )
      .use("*", globalBodyLimitExceptAuditExport)
      .use("*", rateLimitMiddleware)
      .use("*", readOnlyModeMiddleware)
      // nosniff / HSTS / X-Frame-Options 等のセキュリティヘッダを付与する。
      // COOP/CORP は別オリジンの正規クライアント（web/cli）からの利用を阻害しうるため無効化する
      // （クロスオリジンアクセスの制御は CORS が担う）。
      .use("*", secureHeaders({ crossOriginResourcePolicy: false, crossOriginOpenerPolicy: false }))
      .use("*", contextStorage())
      .use("*", nowProductionGuardMiddleware)
      .use("*", systemContextMiddleware)
      .use("*", featureGate)
      .use("*", databaseMiddleware)
      .use("/system/bootstrap", guardBootstrapSignInMethod)
      .use("/company/*", companyAuthenticationMiddleware)
      .onError(handleApiError)
  )
}

/** 生成routeを型計算可能な単位へ分割して合成するための空のHono appを作る。 */
export function createRouteApp() {
  return factory.createApp()
}
