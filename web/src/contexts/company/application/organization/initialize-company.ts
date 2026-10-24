import {
  CompanyBootstrapEntity,
  type CompanyBootstrapInput,
} from "@/contexts/company/domain/entities/company-bootstrap.entity"
import { CompanyForbiddenError, CompanyUnavailableError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyBootstrapRepository } from "@/contexts/company/infrastructure/repositories/organization/company-bootstrap.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
type Context = Readonly<{
  actor: CompanyActorValue
  repository: CompanyBootstrapRepository
  now: Date
  timeZone: string | undefined
}>

/** 明示した会社情報と最初の従業員で、空のCompanyを初期化する。 */
export class InitializeCompany {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async execute(input: CompanyBootstrapInput) {
    if (
      !this.c.actor.hasCapability("company:admin") ||
      !this.c.actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID)
    )
      return new CompanyForbiddenError()
    const observedOn = resolveCompanyBusinessDate({
      now: this.c.now.toISOString(),
      timeZone: this.c.timeZone,
    })
    if (observedOn instanceof Error)
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "company_bootstrap_unavailable",
        { cause: observedOn },
      )
    const command = CompanyBootstrapEntity.create({
      ...input,
      accountId: this.c.actor.accountId,
      observedOn,
      recordedAt: this.c.now.getTime(),
    })
    if (command instanceof Error) return command
    return this.c.repository.initialize(command)
  }
}
