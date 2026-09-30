import {
  CompanyResourceChangeEntity,
  type CompanyResourceChangeProps,
} from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { basicWorkforceResourceTypes } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type {
  D1CompanyResourceRepository,
  CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

type Result =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

type Context = Readonly<{
  actor: CompanyActorValue
  repository: Pick<D1CompanyResourceRepository, "writeOrganizationChange">
}>

/** 組織変更を適用する。 */
export class ApplyOrganizationChange {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(change: Omit<CompanyResourceChangeProps, "actorAccountId">): Promise<Result> {
    const organizationId = change.resources[0]?.organizationId ?? ""
    const props = { ...change, actorAccountId: this.c.actor.accountId }
    const identities = new Set<string>()
    const historyBatch = change.resources.some((resource) => {
      const identity = `${resource.type}\u0000${resource.id}`
      if (identities.has(identity)) return true
      identities.add(identity)
      return false
    })
    const command = historyBatch
      ? CompanyResourceChangeEntity.createHistoryBatch(props)
      : CompanyResourceChangeEntity.create(props)
    if (command instanceof CompanyResourceValidationError) {
      return { kind: "invalid", error: command }
    }
    const basicWorkforceUpdateOnly = change.resources.every((resource) => {
      if (!basicWorkforceResourceTypes.includes(resource.type) || resource.revision <= 1) {
        return false
      }
      if (resource.state === "active") return true
      if (resource.type !== "employment" || !change.evidenceReferences?.length) return false

      const source = change.corrections?.find(
        (correction) =>
          correction.type === resource.type &&
          correction.id === resource.id &&
          correction.revision === resource.revision,
      )
      return (
        source !== undefined &&
        change.resources.some(
          (replacement) =>
            replacement.type === "employment" &&
            replacement.id === resource.id &&
            replacement.state === "active" &&
            replacement.revision > resource.revision &&
            change.corrections?.some(
              (correction) =>
                correction.type === replacement.type &&
                correction.id === replacement.id &&
                correction.revision === replacement.revision &&
                correction.correctsRevision === source.correctsRevision,
            ),
        )
      )
    })
    if (
      !this.c.actor.canAccessOrganization(organizationId) ||
      (!this.c.actor.hasCapability("company:write") &&
        !(basicWorkforceUpdateOnly && this.c.actor.canUpdateWorkforce()))
    ) {
      return { kind: "forbidden" }
    }

    try {
      return await this.c.repository.writeOrganizationChange(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}
