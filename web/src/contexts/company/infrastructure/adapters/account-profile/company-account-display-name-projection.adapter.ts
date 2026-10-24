import { getTableName, sql, type SQL } from "drizzle-orm"
import type { SQLiteColumn } from "drizzle-orm/sqlite-core"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

type Context = Readonly<{ asOf: CalendarDate } | { now: Date; timeZone: string | undefined }>

/** Account表示にも有効日の人物履歴を適用し、接続済みの履歴欠落を古い表示名で補わない。 */
export class CompanyAccountDisplayNameProjectionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  project(
    columns: Readonly<{
      organizationId: SQLiteColumn
      accountId: SQLiteColumn
      displayName: SQLiteColumn
    }>,
  ): SQL<string | null> {
    const asOf =
      "asOf" in this.c
        ? this.c.asOf
        : resolveCompanyBusinessDate({
            now: this.c.now.toISOString(),
            timeZone: this.c.timeZone,
          })
    if (asOf instanceof Error) throw asOf
    const organizationId = sql`${sql.identifier(getTableName(columns.organizationId.table))}.${sql.identifier(columns.organizationId.name)}`
    const accountId = sql`${sql.identifier(getTableName(columns.accountId.table))}.${sql.identifier(columns.accountId.name)}`
    const displayName = sql`${sql.identifier(getTableName(columns.displayName.table))}.${sql.identifier(columns.displayName.name)}`

    return sql<string | null>`CASE WHEN EXISTS (
      SELECT 1 FROM company_account_employee_resource_bindings display_link
      WHERE display_link.account_id = ${accountId}
        AND display_link.organization_id = ${organizationId}
    ) THEN (
      SELECT CASE WHEN count(*) = 1 THEN min(json_extract(display_person.attributes_json, '$.officialName')) ELSE NULL END
      FROM company_account_employee_resource_bindings display_link
      JOIN company_resource_revisions display_link_revision
        ON display_link_revision.organization_id = display_link.organization_id
        AND display_link_revision.resource_type = 'account-employee-link'
        AND display_link_revision.resource_id = display_link.resource_id
        AND display_link_revision.revision = (
          SELECT revision FROM company_resource_revisions current_display_link
          WHERE current_display_link.organization_id = display_link.organization_id
            AND current_display_link.resource_type = 'account-employee-link'
            AND current_display_link.resource_id = display_link.resource_id
            AND current_display_link.effective_from <= ${asOf}
          ORDER BY effective_from DESC, revision DESC LIMIT 1)
      JOIN company_workforce_resource_bindings display_binding
        ON display_binding.employee_id = display_link.employee_id
        AND display_binding.resource_type = 'employee'
        AND display_binding.organization_id = ${organizationId}
      JOIN company_resource_revisions display_employee
        ON display_employee.organization_id = display_binding.organization_id
        AND display_employee.resource_type = 'employee' AND display_employee.resource_id = display_binding.resource_id
        AND display_employee.revision = (
          SELECT revision FROM company_resource_revisions current_display_employee
          WHERE current_display_employee.organization_id = display_employee.organization_id
            AND current_display_employee.resource_type = 'employee'
            AND current_display_employee.resource_id = display_employee.resource_id
            AND current_display_employee.effective_from <= ${asOf}
          ORDER BY effective_from DESC, revision DESC LIMIT 1)
      JOIN company_resource_revisions display_person
        ON display_person.organization_id = display_employee.organization_id
        AND display_person.resource_type = 'person'
        AND display_person.resource_id = json_extract(display_employee.attributes_json, '$.personId')
        AND display_person.revision = (
          SELECT revision FROM company_resource_revisions current_display_person
          WHERE current_display_person.organization_id = display_person.organization_id
            AND current_display_person.resource_type = 'person'
            AND current_display_person.resource_id = display_person.resource_id
            AND current_display_person.effective_from <= ${asOf}
          ORDER BY effective_from DESC, revision DESC LIMIT 1)
      WHERE display_link.account_id = ${accountId}
        AND display_link.organization_id = ${organizationId}
        AND display_link_revision.state = 'active'
        AND (display_link_revision.effective_to IS NULL OR ${asOf} < display_link_revision.effective_to)
        AND json_extract(display_link_revision.attributes_json, '$.accountId') = display_link.account_id
        AND json_extract(display_link_revision.attributes_json, '$.employeeId') = display_link.employee_id
        AND display_employee.state = 'active' AND (display_employee.effective_to IS NULL OR ${asOf} < display_employee.effective_to)
        AND display_person.state = 'active' AND (display_person.effective_to IS NULL OR ${asOf} < display_person.effective_to)
    ) ELSE ${displayName} END`
  }
}
