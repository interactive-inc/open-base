import { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { HonoEnv } from "@/env"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { resolveLiveEmployeeAccess } from "@/api/http/employees/resolve-live-employee-access"
import { resolveCompanyAccountEmployeeLink } from "@/contexts/company/interface/operations/resolve-company-account-employee-link"
import type { SystemAccountId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { UnauthorizedError } from "@/lib/http/errors"
import { createMiddleware } from "hono/factory"
import { authenticateSystemBearer } from "@/api/http/authenticate-system-bearer"

/**
 * Bearer トークンを検証し、本人と権限を c.var.session に載せる。
 * 権限は JWT に載せず毎回 DB 解決する(改竄面の排除・即時失効)。
 * tokenVersion 不一致・account 非 active・employee retired は即 401。
 */
export const verifyBearer = createMiddleware<HonoEnv>(async (c, next) => {
  await authenticateSystemBearer(c)
  const accountId = c.var.userId
  const workforceAccountId = restoreWorkforceId("system_account", accountId)
  const account = await resolveCompanyAccountEmployeeLink(
    c,
    {
      evaluate: async (candidate: SystemAccountId) => ({
        ok: true as const,
        eligible: candidate === workforceAccountId,
      }),
    },
    { kind: "by_account", accountId: workforceAccountId },
  )
  if (account.kind === "unavailable" || account.kind === "invalid_link") {
    throw new UnauthorizedError("account authentication is unavailable")
  }
  if (account.kind !== "found") throw new UnauthorizedError("account not found")

  const access = await resolveLiveEmployeeAccess(c, account.link.employeeId)
  if (access === null || access instanceof Error) {
    throw new UnauthorizedError("employee is unavailable")
  }

  c.set(
    "session",
    new CompanySessionValue({
      accountId,
      employeeId: account.link.employeeId,
      employmentStatus: access.status,
      permissions: c.var.permissions,
      roleKeys: (c.var.roleKeys ?? []).map((key) => key.replace(/^company:/, "")),
    }),
  )

  await next()
})
