import {
  OrganizationProfileChangeEntity,
  type OrganizationProfileChangeInput,
} from "@/contexts/company/domain/entities/organization-profile-change.entity"
import { CompanyForbiddenError, CompanyUnavailableError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { OrganizationProfileChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-profile-change.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

type Context = Readonly<{
  actor: CompanyActorValue
  repository: OrganizationProfileChangeRepository
  now: Date
  timeZone: string | undefined
}>

/** 確認した会社プロフィールを、表示した版と営業日で更新する。 */
export class UpdateOrganizationProfile {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async execute(input: OrganizationProfileChangeInput) {
    if (
      !this.c.actor.canAccessOrganization(input.version.organizationId) ||
      !this.c.actor.hasCapability("company:write")
    )
      return new CompanyForbiddenError()
    if (!Number.isSafeInteger(this.c.now.getTime()))
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "organization_profile_unavailable",
      )
    const observedOn = resolveCompanyBusinessDate({
      now: this.c.now.toISOString(),
      timeZone: this.c.timeZone,
    })
    if (observedOn instanceof Error)
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "organization_profile_unavailable",
        { cause: observedOn },
      )
    const command = OrganizationProfileChangeEntity.create({
      ...input,
      actorAccountId: this.c.actor.accountId,
      observedOn,
      recordedAt: this.c.now.getTime(),
    })
    if (command instanceof Error) return command
    return this.c.repository.change(command)
  }
}
