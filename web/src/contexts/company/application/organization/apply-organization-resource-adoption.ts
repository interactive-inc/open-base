import {
  OrganizationResourceAdoptionEntity,
  type OrganizationResourceAdoptionInput,
} from "@/contexts/company/domain/entities/organization-resource-adoption.entity"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { OrganizationResourceAdoptionRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-resource-adoption.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
type Context = Readonly<{
  actor: CompanyActorValue
  repository: OrganizationResourceAdoptionRepository
  now: Date
}>

/** 確認した組織の全期間履歴を公開正本へ接続する。 */
export class ApplyOrganizationResourceAdoption {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async execute(input: OrganizationResourceAdoptionInput) {
    if (
      !this.c.actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !this.c.actor.hasCapability("company:admin")
    )
      return new CompanyForbiddenError()
    const command = OrganizationResourceAdoptionEntity.create({
      ...input,
      actorAccountId: this.c.actor.accountId,
      recordedAt: this.c.now.getTime(),
    })
    if (command instanceof Error) return command
    return this.c.repository.adopt(command)
  }
}
