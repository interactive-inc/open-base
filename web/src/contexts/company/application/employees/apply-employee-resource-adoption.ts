import {
  EmployeeResourceAdoptionEntity,
  type EmployeeResourceAdoptionInput,
} from "@/contexts/company/domain/entities/employee-resource-adoption.entity"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { EmployeeResourceAdoptionRepository } from "@/contexts/company/infrastructure/repositories/employee-resource-adoption/employee-resource-adoption.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{
  actor: CompanyActorValue
  repository: EmployeeResourceAdoptionRepository
  now: Date
}>

/** 確認した従業員の人物・雇用履歴を会社の公開正本へ接続する。 */
export class ApplyEmployeeResourceAdoption {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: EmployeeResourceAdoptionInput) {
    if (
      !this.c.actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !this.c.actor.hasCapability("company:admin")
    )
      return new CompanyForbiddenError()
    const command = EmployeeResourceAdoptionEntity.create({
      ...input,
      actorAccountId: this.c.actor.accountId,
      recordedAt: this.c.now.getTime(),
    })
    if (command instanceof Error) return command
    return this.c.repository.adopt(command)
  }
}
