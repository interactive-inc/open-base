import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmploymentType } from "@/contexts/company/domain/definitions/employment-type.definition"
import { initialWorkforceResources } from "@/contexts/company/domain/definitions/initial-workforce-resources.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { AbortWhenPreviousStatementChangedNoRowsAdapter } from "@/contexts/company/infrastructure/adapters/database/abort-when-previous-statement-changed-no-rows.adapter"
import { CompanyEmploymentResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-employment-resource-projection.adapter"
import { CompanyWorkforceResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-workforce-resource-projection.adapter"
import { drizzle } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Props = Readonly<{
  employeeId: string
  employmentId: string
  officialName: string
  employeeCode: string | null
  email: string | null
  phone: string | null
  employmentType: EmploymentType
  status: "active" | "leave"
  effectiveOn: CalendarDate
  accountLink?: Readonly<{ accountId: string; effectiveOn: CalendarDate }>
  commandId: string
  actorAccountId: string
  reason: string
  recordedAt: number
  expectedOrganizationRevision: number
  /** 呼び出し側が書く発令。期間の記録元と、binding の最後の発令になる。 */
  actionId: string
  businessDate: string
  /** 発令を書いた後の従業員の改訂番号。 */
  lifecycleRevision: number
}>

export type PublishedInitialWorkforce = Readonly<{
  /** 公開 resource と、人、従業員、Account との対応の投影。発令の行より前に置く。 */
  identityStatements: ReadonlyArray<D1PreparedStatement>
  /** 雇用の投影。発令の行の後、雇用を参照する期間の書込みより前に置く。 */
  employmentStatements: ReadonlyArray<D1PreparedStatement>
  /** binding の確定と会社版の確定。最後に置く。 */
  commitStatements: ReadonlyArray<D1PreparedStatement>
  organizationRevision: number
}>

type Context = D1Database

/**
 * 新しい従業員と最初の雇用を、公開 resource を正本として作る。
 *
 * 従業員と雇用の表、期間は公開 resource の投影として書く。発令の行と改訂番号は呼び出し側が書く。
 * 発令の行は従業員を参照し、期間は発令を参照するので、文を 3 つの位置に分けて返す。
 */
export class PublishedInitialWorkforceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(props: Props): Promise<PublishedInitialWorkforce | Error> {
    const change = CompanyResourceChangeEntity.create({
      commandId: props.commandId,
      actorAccountId: props.actorAccountId,
      expectedRevision: props.expectedOrganizationRevision,
      reason: props.reason,
      recordedAt: props.recordedAt,
      resources: [...initialWorkforceResources(props)],
    })
    if (change instanceof Error) return change
    const journal = await new CompanyResourceJournalAdapter({
      database: drizzle(this.c),
      d1: this.c,
    }).prepare(change)
    if (journal instanceof Error) return journal
    const identity = await new CompanyWorkforceResourceProjectionAdapter(this.c).prepareIdentity(
      change,
    )
    if (identity instanceof Error) return identity
    const employment = change.resources.find((resource) => resource.type === "employment")
    if (employment === undefined) return new Error("initial employment resource is missing")
    const employmentStatements = await new CompanyEmploymentResourceProjectionAdapter(
      this.c,
    ).prepare({
      resource: employment,
      stagedHistory: [employment],
      change,
      fingerprint: journal.fingerprint,
      revisionOffset: 0,
      recordedBy: { actionId: props.actionId, businessDate: props.businessDate },
    })
    if (employmentStatements instanceof Error) return employmentStatements

    return {
      identityStatements: [...journal.statements, ...identity],
      employmentStatements,
      commitStatements: [
        this.c
          .prepare(`UPDATE company_workforce_resource_bindings
          SET lifecycle_revision = ?1, last_action_id = ?2
          WHERE resource_type = 'employee' AND resource_id = ?3`)
          .bind(props.lifecycleRevision, props.actionId, props.employeeId),
        new AbortWhenPreviousStatementChangedNoRowsAdapter(
          this.c,
        ).abortWhenPreviousStatementChangedNoRows(),
        this.c
          .prepare(`INSERT INTO company_workforce_resource_bindings
          (resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision, last_action_id)
          VALUES ('employment', ?1, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?2, 1, ?3, ?4)`)
          .bind(props.employmentId, props.employeeId, props.lifecycleRevision, props.actionId),
        journal.commit,
      ],
      organizationRevision: props.expectedOrganizationRevision + 1,
    }
  }
}
