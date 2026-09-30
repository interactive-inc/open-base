import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { PrepareRecordRetirementCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-coverage.adapter"

type Context = SystemD1Context &
  Readonly<{ now: () => Date; assertions: ReadonlyArray<D1PreparedStatement> }>

/** 計画内の全記録を現在のAccountが同じ目的で読めることを検査する。本文取得と保持検査は行わない。 */
export class PrepareRecordRetirementDisclosureAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, authentication: SystemReadAuthentication) {
    if (this.c.assertions.length === 0) return new Error("retirement disclosure guards required")
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      this.c.now(),
    )
    if (proof instanceof Error) return proof
    if (proof === null || !proof.permissionKeys.has(SystemFeaturePermission.RECORD_READ.key))
      return new Error("retirement disclosure authorization denied")
    const authority = proof.assertions(this.c.now())
    if (authority instanceof Error) return authority
    const coverage = await new PrepareRecordRetirementCoverageAdapter({
      env: this.c.env,
      assertions: [...this.c.assertions, ...authority],
    }).prepare(input)
    if (coverage instanceof Error) return coverage
    const current = proof.assertions(this.c.now())
    if (current instanceof Error) return current
    const guard = this.c.env.DB.prepare(`WITH evaluation AS (
      SELECT max(?3,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
    ) SELECT CASE WHEN NOT EXISTS (
      SELECT 1 FROM system_record_retirement_plans plan
      JOIN json_each(plan.snapshot_json,'$.coverage') kind
      JOIN system_record_coverage_entries entry ON entry.freeze_id=plan.freeze_id
        AND entry.record_kind IS json_extract(kind.value,'$.recordKind')
      LEFT JOIN system_preserved_records record ON record.id=entry.preserved_record_id
      WHERE plan.id=?1 AND (record.id IS NULL OR NOT EXISTS (
        SELECT 1 FROM system_record_disclosure_policies policy, json_each(policy.snapshot_json,'$.grants') grant_entry
        WHERE policy.id=record.disclosure_policy_id AND policy.record_id=record.id
          AND NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies newer WHERE newer.id=policy.id AND newer.revision>policy.revision)
          AND json_extract(policy.snapshot_json,'$.status')='active'
          AND round((julianday(json_extract(policy.snapshot_json,'$.publishedAt'))-2440587.5)*86400000)<=(SELECT at FROM evaluation)
          AND json_extract(grant_entry.value,'$.accountId')=?2
          AND EXISTS (SELECT 1 FROM json_each(grant_entry.value,'$.actions') action WHERE action.value='read')
          AND EXISTS (SELECT 1 FROM json_each(grant_entry.value,'$.purposes') purpose WHERE purpose.value=json_extract(plan.snapshot_json,'$.purpose'))
          AND round((julianday(json_extract(grant_entry.value,'$.validFrom'))-2440587.5)*86400000)<=(SELECT at FROM evaluation)
          AND (json_type(grant_entry.value,'$.validUntil')='null'
            OR round((julianday(json_extract(grant_entry.value,'$.validUntil'))-2440587.5)*86400000)>(SELECT at FROM evaluation))
      ))
    ) THEN 1 ELSE json_extract('{}','record_retirement_disclosure_changed') END`).bind(
      coverage.planId,
      authentication.accountId,
      this.c.now().getTime(),
    )
    const assertions = Object.freeze([...coverage.assertions, ...current, guard])
    try {
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement disclosure unavailable")
      return Object.freeze({ coverage, actorAccountId: authentication.accountId, assertions })
    } catch (cause) {
      return new Error("retirement disclosure unavailable", { cause })
    }
  }
}
