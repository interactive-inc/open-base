import type { z } from "zod"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { preservedRecordSearchSchema } from "@system/domain/schemas/records/preserved-record-search.schema"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SearchPreservedRecordsAdapter } from "@system/infrastructure/adapters/records/search-preserved-records.adapter"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context &
  Readonly<{
    authorizationAssertions: (at: Date) => ReadonlyArray<D1PreparedStatement> | Error
  }>
type Search = z.output<typeof preservedRecordSearchSchema> & Readonly<{ accountId: string }>

/** 開示資格の再検査と一覧の閲覧監査を同じtransactionで確定する。 */
export class DisclosePreservedRecordIndexPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findCandidates(search: Search, after: string | null, at: Date) {
    const assertions = this.c.authorizationAssertions(at)
    if (assertions instanceof Error) return assertions
    return new SearchPreservedRecordsAdapter({ env: this.c.env, assertions }).findCandidates(
      search,
      after,
    )
  }

  async write(
    input: Readonly<{
      policies: ReadonlyArray<PreservedRecordDisclosurePolicyEntity>
      accountId: string
      action: "read" | "export"
      purpose: string
      at: Date
      audit: SystemAuditEventEntity
    }>,
  ) {
    const assertions = this.c.authorizationAssertions(input.at)
    if (assertions instanceof Error) return assertions
    if (assertions.length === 0) return new Error("record authorization is required")
    const guards = [...assertions]
    const repository = new PreservedRecordDisclosurePolicyRepository({
      env: this.c.env,
      assertions: [],
    })
    for (const policy of input.policies) {
      const policyGuards = repository.prepareDisclosureGuard(policy, {
        recordId: policy.snapshot.recordId,
        accountId: input.accountId,
        action: input.action,
        purpose: input.purpose,
        at: input.at,
      })
      if (policyGuards instanceof Error) return policyGuards
      guards.push(...policyGuards)
    }
    return new SystemAuditEventRepository(this.c).append(input.audit, guards)
  }
}
