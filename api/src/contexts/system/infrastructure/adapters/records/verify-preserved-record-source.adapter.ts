import { PreparePreservedRecordRetentionGuardAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-retention-guard.adapter"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"
import type {
  SystemD1Context,
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { DisclosePreservedRecordContent } from "@system/application/records/disclose-preserved-record-content"
import { DisclosePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-persistence.adapter"

type Context = SystemD1Context &
  SystemDatabaseContext &
  SystemAttachmentStorageContext &
  Readonly<{
    now: () => Date
    assertions: ReadonlyArray<D1PreparedStatement>
  }>

/** 現在の開示資格で保全本文を復号・監査し、期待する原記録の内容と来歴を照合する。 */
export class VerifyPreservedRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: Readonly<{
      authentication: SystemReadAuthentication
      recordId: string
      purpose: string
      source: PreservedRecordSourceValue
    }>,
  ) {
    if (this.c.assertions.length === 0) return new Error("source verification guards required")
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      input.authentication,
      this.c.now(),
    )
    if (proof instanceof Error) return proof
    if (proof === null || !proof.permissionKeys.has(SystemFeaturePermission.RECORD_READ.key))
      return new Error("record source verification denied")
    const authorization = proof.assertions(this.c.now())
    if (authorization instanceof Error) return authorization
    const first = authorization.at(0)
    if (first === undefined)
      return new Error("record source verification authorization unavailable")
    const disclosed = await new DisclosePreservedRecordContent({
      env: this.c.env,
      var: this.c.var,
      accountId: input.authentication.accountId,
      now: this.c.now,
      persistence: new DisclosePreservedRecordPersistenceAdapter({
        env: this.c.env,
        assertions: [first, ...authorization.slice(1), ...this.c.assertions],
      }),
    }).execute({ recordId: input.recordId, action: "read", purpose: input.purpose })
    if (disclosed instanceof Error) return disclosed
    const source = PreservedRecordSourceValue.create(disclosed.source)
    if (source instanceof Error) return source
    if (!input.source.matchesSource(source))
      return new Error("preserved content differs from expected source")
    const record = await new PreservedRecordRepository({
      env: this.c.env,
      assertions: disclosed.assertions,
    }).find(disclosed.recordId)
    if (record instanceof Error) return record
    if (record === null || !record.source.matchesSource(source))
      return new Error("preserved record receipt changed")
    const retention = await new PreparePreservedRecordRetentionGuardAdapter({
      env: this.c.env,
      assertions: disclosed.assertions,
    }).prepare(record, this.c.now())
    if (retention instanceof Error) return retention
    return Object.freeze({
      recordId: disclosed.recordId,
      source: source.props,
      assertions: retention.assertions,
    })
  }
}
