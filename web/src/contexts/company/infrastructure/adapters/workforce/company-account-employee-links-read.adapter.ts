import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { AccountEmployeeLink } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { z } from "zod"

type Context = Readonly<{ env: CompanyContext["env"] }>
type Query = Readonly<{
  accountIds?: ReadonlyArray<string>
  employeeIds?: ReadonlyArray<string>
  asOf?: CalendarDate
}>
const rowSchema = z.object({ account_id: z.string(), employee_id: z.string() })

/** 終了と取消を旧対応で補わず、同じ営業日のAccount対応を一括して読む。 */
export class CompanyAccountEmployeeLinksReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(query: Query): Promise<ReadonlyArray<AccountEmployeeLink> | Error> {
    if (query.accountIds?.length === 0 || query.employeeIds?.length === 0) return []
    const asOf =
      query.asOf ??
      resolveCompanyBusinessDate({
        now: this.c.env.NOW ?? new Date().toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
    if (asOf instanceof Error) return asOf
    try {
      const parameters: string[] = [asOf]
      const filters = [
        "revision.state = 'active'",
        "(revision.effective_to IS NULL OR ?1 < revision.effective_to)",
        "json_extract(revision.attributes_json, '$.accountId') = link.account_id",
        "json_extract(revision.attributes_json, '$.employeeId') = link.employee_id",
      ]
      for (const [column, ids] of [
        ["link.account_id", query.accountIds],
        ["link.employee_id", query.employeeIds],
      ] satisfies ReadonlyArray<readonly [string, ReadonlyArray<string> | undefined]>) {
        if (ids === undefined) continue
        parameters.push(JSON.stringify([...new Set(ids)]))
        filters.push(`${column} IN (SELECT value FROM json_each(?${parameters.length}))`)
      }
      const rows = await this.c.env.DB.prepare(`SELECT link.account_id, link.employee_id
        FROM company_account_employee_resource_bindings link
        JOIN company_resource_revisions revision
          ON revision.organization_id = link.organization_id
          AND revision.resource_type = 'account-employee-link'
          AND revision.resource_id = link.resource_id
          AND revision.revision = (
            SELECT current_link.revision FROM company_resource_revisions current_link
            WHERE current_link.organization_id = link.organization_id
              AND current_link.resource_type = 'account-employee-link'
              AND current_link.resource_id = link.resource_id
              AND current_link.effective_from <= ?1
            ORDER BY current_link.effective_from DESC, current_link.revision DESC LIMIT 1)
        WHERE ${filters.join(" AND ")}
        ORDER BY link.employee_id, link.account_id`)
        .bind(...parameters)
        .all()
      if (!rows.success) return new Error("Company Account links are unavailable")
      const parsed = z.array(rowSchema).safeParse(rows.results)
      if (!parsed.success) return parsed.error
      if (
        new Set(parsed.data.map((row) => row.account_id)).size !== parsed.data.length ||
        new Set(parsed.data.map((row) => row.employee_id)).size !== parsed.data.length
      ) {
        return new Error("Company Account links are ambiguous")
      }
      return parsed.data.map((row) =>
        Object.freeze({
          accountId: restoreWorkforceId("system_account", row.account_id),
          employeeId: restoreWorkforceId("employee", row.employee_id),
        }),
      )
    } catch (cause) {
      return new Error("failed to read Company Account links", { cause })
    }
  }
}
