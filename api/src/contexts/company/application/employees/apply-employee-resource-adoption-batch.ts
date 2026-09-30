import {
  EmployeeResourceAdoptionBatchEntity,
  type EmployeeResourceAdoptionBatchInput,
} from "@/contexts/company/domain/entities/employee-resource-adoption-batch.entity"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { EmployeeResourceAdoptionBatchRepository } from "@/contexts/company/infrastructure/repositories/employee-resource-adoption/employee-resource-adoption-batch.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{
  actor: CompanyActorValue
  repository: EmployeeResourceAdoptionBatchRepository
  now: Date
}>

/** 確認した全従業員の既存公開履歴を一括で接続する。 */
export class ApplyEmployeeResourceAdoptionBatch {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: EmployeeResourceAdoptionBatchInput) {
    if (
      !this.c.actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !this.c.actor.hasCapability("company:admin")
    )
      return new CompanyForbiddenError()

    const command = EmployeeResourceAdoptionBatchEntity.create({
      ...input,
      actorAccountId: this.c.actor.accountId,
      recordedAt: this.c.now.getTime(),
    })
    if (command instanceof Error) return command
    return this.c.repository.adopt(command)
  }
}
