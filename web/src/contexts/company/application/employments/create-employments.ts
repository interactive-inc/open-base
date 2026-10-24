import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import {
  CompanyResourceChangeEntity,
  type CompanyResourceChangeProps,
} from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type {
  CompanyResourceRepository,
  CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

type Result =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

type Context = Readonly<{
  actor: CompanyActorValue
  repository: CompanyResourceRepository
}>

/** 雇用契約を登録する。 */
export class CreateEmployments {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(change: Omit<CompanyResourceChangeProps, "actorAccountId">): Promise<Result> {
    const organizationId = change.resources[0]?.organizationId ?? ""
    if (
      !this.c.actor.canAccessOrganization(organizationId) ||
      !this.c.actor.hasCapability("company:write")
    ) {
      return { kind: "forbidden" }
    }

    const command = CompanyResourceChangeEntity.create({
      ...change,
      actorAccountId: this.c.actor.accountId,
    })
    if (command instanceof CompanyResourceValidationError) {
      return { kind: "invalid", error: command }
    }

    const resourceTypes: ReadonlyArray<CompanyResourceType> = ["employment"]
    if (
      command.resources.some(
        (resource) =>
          !resourceTypes.includes(resource.type) ||
          resource.revision !== 1 ||
          resource.state !== "active",
      )
    ) {
      return { kind: "invalid", error: new CompanyResourceValidationError("invalid_change") }
    }

    try {
      return await this.c.repository.write(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}
