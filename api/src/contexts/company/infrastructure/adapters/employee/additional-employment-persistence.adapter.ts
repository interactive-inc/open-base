import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmploymentType } from "@/contexts/company/domain/definitions/employment-type.definition"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { CompanyWorkforceResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-workforce-resource-projection.adapter"
import { drizzle } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Employment = Readonly<{
  employeeId: string
  employmentId: string
  employmentType: EmploymentType
  effectiveOn: CalendarDate
  status: "ACTIVE" | "ON_LEAVE"
  actorAccountId: string
  occurredAt: Date
  operationId: string
  reason: string
}>
type Context = D1Database

/** 接続済み従業員への雇用追加を、公開履歴・期間・人事記録と同じtransactionへ載せる。 */
export class AdditionalEmploymentPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepareMany(
    inputs: ReadonlyArray<Employment>,
    expectedOrganizationRevision: number,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    if (new Set(inputs.map((input) => input.employeeId)).size !== inputs.length)
      return new Error("one additional employment per employee is required")
    const statements: D1PreparedStatement[] = []
    for (const [index, input] of inputs.entries()) {
      const change = CompanyResourceChangeEntity.create({
        commandId: input.operationId,
        actorAccountId: input.actorAccountId,
        expectedRevision: expectedOrganizationRevision + index,
        reason: input.reason,
        recordedAt: input.occurredAt.getTime(),
        resources: [
          {
            organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
            type: "employment",
            id: input.employmentId,
            revision: 1,
            state: "active",
            effectiveFrom: input.effectiveOn,
            effectiveTo: null,
            attributes: {
              employeeId: input.employeeId,
              employmentType: input.employmentType,
              status: input.status,
            },
          },
        ],
      })
      if (change instanceof Error) return change
      const journal = await new CompanyResourceJournalAdapter({
        database: drizzle(this.c),
        d1: this.c,
      }).prepare(change)
      if (journal instanceof Error) return journal
      const projection = await new CompanyWorkforceResourceProjectionAdapter(this.c).prepare(
        change,
        journal.fingerprint,
      )
      if (projection instanceof Error) return projection
      statements.push(...journal.statements, ...projection, journal.commit)
    }
    return statements
  }
}
