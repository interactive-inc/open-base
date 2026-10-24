import { sql, type SQL, type SQLWrapper } from "drizzle-orm"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

type Context = Readonly<{ asOf: CalendarDate } | { now: Date; timeZone: string | undefined }>

/** Account対応を公開履歴の指定時点から解決する。 */
export class CompanyAccountEmployeeLinkPredicateAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  matches(columns: Readonly<{ accountId: SQLWrapper; employeeId: SQLWrapper }>): SQL {
    const asOf =
      "asOf" in this.c
        ? this.c.asOf
        : resolveCompanyBusinessDate({
            now: this.c.now.toISOString(),
            timeZone: this.c.timeZone,
          })
    if (asOf instanceof Error) throw asOf
    return sql`EXISTS (SELECT 1 FROM company_account_employee_resource_bindings effective_link
      JOIN company_resource_revisions link_revision
        ON link_revision.organization_id = effective_link.organization_id
        AND link_revision.resource_type = 'account-employee-link'
        AND link_revision.resource_id = effective_link.resource_id
        AND link_revision.revision = (
          SELECT current_link.revision FROM company_resource_revisions current_link
          WHERE current_link.organization_id = effective_link.organization_id
            AND current_link.resource_type = 'account-employee-link'
            AND current_link.resource_id = effective_link.resource_id
            AND current_link.effective_from <= ${asOf}
          ORDER BY current_link.effective_from DESC, current_link.revision DESC LIMIT 1)
      WHERE effective_link.account_id = ${columns.accountId}
        AND effective_link.employee_id = ${columns.employeeId}
        AND link_revision.state = 'active'
        AND (link_revision.effective_to IS NULL OR ${asOf} < link_revision.effective_to)
        AND json_extract(link_revision.attributes_json, '$.accountId') = effective_link.account_id
        AND json_extract(link_revision.attributes_json, '$.employeeId') = effective_link.employee_id)`
  }
}
