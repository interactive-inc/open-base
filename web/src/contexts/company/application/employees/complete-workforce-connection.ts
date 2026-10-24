import {
  WorkforceConnectionCompletionEntity,
  type WorkforceConnectionCompletionInput,
} from "@/contexts/company/domain/entities/workforce-connection-completion.entity"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { WorkforceConnectionCompletionRepository } from "@/contexts/company/infrastructure/repositories/employee/workforce-connection-completion.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{
  actor: CompanyActorValue
  repository: WorkforceConnectionCompletionRepository
  now: Date
}>

/** 全件の接続を確かめた会社管理者が、接続の完了を一度だけ記録する。 */
export class CompleteWorkforceConnection {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: WorkforceConnectionCompletionInput) {
    if (
      !this.c.actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !this.c.actor.hasCapability("company:admin")
    )
      return new CompanyForbiddenError()
    const completion = WorkforceConnectionCompletionEntity.create({
      ...input,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      actorAccountId: this.c.actor.accountId,
      recordedAt: this.c.now.getTime(),
    })
    if (completion instanceof Error) return completion
    return this.c.repository.complete(completion)
  }
}
