import { openCompanyAuditEvents } from "@/contexts/company/interface/operations/open-company-audit-events"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { AuditEventInput } from "@/contexts/company/domain/definitions/company-audit-event.definition"
import { createAuditEvent } from "@/contexts/company/domain/definitions/company-audit-event.definition"
import type { Context } from "@/env"
import type { CompanyAuditEventFilters as AuditEventFilters } from "@/contexts/company/interface/operations/open-company-audit-events"
import { toHttpException } from "@/lib/http/to-http-exception"
import { auditUnavailable } from "@/api/http/audit/audit-unavailable"
import { hashAuditFilters } from "@/api/http/audit/hash-audit-filters"
import { resolveAuditNow } from "@/api/http/audit/resolve-audit-now"
import { throwAuditRouteError } from "@/api/http/audit/throw-audit-route-error"
import { ForbiddenError } from "@/lib/errors"

type ManagedAuditInput = Omit<AuditEventInput, "actorAccountId" | "actorEmployeeId" | "now">

/**
 * 監査ログルート自身の操作記録と権限ゲート。session の本人情報と注入クロックを補って
 * 監査イベントを追記し、権限が無い場合は denied を記録したうえで 403 を投げる
 */
export class AuditTrail {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** audit:read が無ければ denied を記録して 403。search/detail 共通のゲート本体。 */
  async requireReadPermission(kind: "search" | "detail", next: () => Promise<void>): Promise<void> {
    let session: CompanySessionValue
    try {
      session = this.sessionOf()
    } catch (error) {
      throwAuditRouteError(error)
    }
    if (session.hasPermission("audit:read")) {
      await next()
      return
    }

    try {
      await this.appendReadDenied(kind)
    } catch (error) {
      throwAuditRouteError(error)
    }
    throw toHttpException(new ForbiddenError("audit read is forbidden", "audit_read_forbidden"))
  }

  /** audit:export が無ければ denied を記録して 403。 */
  async requireExportPermission(next: () => Promise<void>): Promise<void> {
    let session: CompanySessionValue
    try {
      session = this.sessionOf()
    } catch (error) {
      throwAuditRouteError(error)
    }
    if (session.hasPermission("audit:export")) {
      await next()
      return
    }

    try {
      await this.appendExportDenied()
    } catch (error) {
      throwAuditRouteError(error)
    }
    throw toHttpException(new ForbiddenError("audit export is forbidden", "audit_export_forbidden"))
  }

  async appendSearchSucceeded(
    filters: AuditEventFilters,
    requestedLimit: number,
    resultCount: number,
  ): Promise<void> {
    const filterHash = await hashAuditFilters(filters)
    await this.append({
      action: "audit.event.searched",
      target: { type: "audit_event", id: null },
      outcome: "succeeded",
      reasonCode: null,
      authorization: { permission_keys: ["audit:read"] },
      metadata: {
        filter_hash: filterHash,
        requested_limit: requestedLimit,
        result_count: resultCount,
        format: "json",
      },
    })
  }

  async appendReadSucceeded(eventId: string, resultCount: 0 | 1): Promise<void> {
    await this.append({
      action: "audit.event.read",
      target: { type: "audit_event", id: eventId },
      outcome: "succeeded",
      reasonCode: null,
      authorization: { permission_keys: ["audit:read"] },
      metadata: { result_count: resultCount, format: "json" },
    })
  }

  async appendExportSucceeded(filters: AuditEventFilters, resultCount: number): Promise<void> {
    const filterHash = await hashAuditFilters(filters)
    await this.append({
      action: "audit.event.exported",
      target: { type: "audit_export", id: null },
      outcome: "succeeded",
      reasonCode: null,
      authorization: { permission_keys: ["audit:export"] },
      metadata: { filter_hash: filterHash, result_count: resultCount, format: "csv" },
    })
  }

  async appendExportTooLarge(filters: AuditEventFilters): Promise<void> {
    const filterHash = await hashAuditFilters(filters)
    await this.append({
      action: "audit.event.exported",
      target: { type: "audit_export", id: null },
      outcome: "failed",
      reasonCode: "audit_export_too_large",
      authorization: { permission_keys: ["audit:export"] },
      metadata: { filter_hash: filterHash, format: "csv" },
    })
  }

  private sessionOf(): CompanySessionValue {
    const session = this.c.var.session
    if (session === null) throw auditUnavailable(new Error("audit session is missing"))
    return session
  }

  private async append(input: ManagedAuditInput): Promise<void> {
    try {
      const session = this.sessionOf()
      const record = createAuditEvent(
        {
          ...input,
          actorAccountId: session.accountId,
          actorEmployeeId: session.employeeId,
          now: resolveAuditNow(this.c.env.NOW),
        },
        this.c.var.auditContext,
      )
      await openCompanyAuditEvents(this.c).append(record)
    } catch (error) {
      throw auditUnavailable(error)
    }
  }

  private async appendReadDenied(kind: "search" | "detail"): Promise<void> {
    await this.append({
      action: kind === "search" ? "audit.event.searched" : "audit.event.read",
      target: { type: "audit_event", id: null },
      outcome: "denied",
      reasonCode: "permission_denied",
      authorization: { required_permission_keys: ["audit:read"] },
      metadata: { format: "json" },
    })
  }

  private async appendExportDenied(): Promise<void> {
    await this.append({
      action: "audit.event.exported",
      target: { type: "audit_export", id: null },
      outcome: "denied",
      reasonCode: "permission_denied",
      authorization: { required_permission_keys: ["audit:export"] },
      metadata: { format: "csv" },
    })
  }
}
