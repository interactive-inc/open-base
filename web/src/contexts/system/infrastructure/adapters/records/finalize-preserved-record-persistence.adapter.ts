import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import type { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"

type Context = SystemD1Context &
  Readonly<{
    assertions: readonly [D1PreparedStatement, ...D1PreparedStatement[]]
    authorization: ExecutionAuthorizationEntity
    executionGuards: readonly [D1PreparedStatement, ...D1PreparedStatement[]]
  }>
type Command = Readonly<{
  record: PreservedRecordEntity
  disclosure: PreservedRecordDisclosurePolicyEntity
  preservation: AttachmentPreservationEntity
}>

type WriteInput = Readonly<{
  command: Command
  recordAudit: SystemAuditEventEntity
  policyAudit: SystemAuditEventEntity
  holdAudit: SystemAuditEventEntity
  attachment: SystemAttachmentRow
}>

/** 保全確定の資格検査・再送照合・一括保存をD1 transactionで行う。 */
export class FinalizePreservedRecordPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(command: Command): Promise<PreservedRecordEntity | null | Error> {
    const proposal = await RecordPreservationProposalValue.create(command)
    if (proposal instanceof Error) return proposal
    if (
      this.c.authorization.operationKey !== "system.record.preserve" ||
      this.c.authorization.grantedToAccountId !== command.record.snapshot.actorAccountId ||
      this.c.authorization.proposalDigest !== proposal.props.digest.toString()
    )
      return new Error("record replay authorization does not match")
    const existing = await new PreservedRecordRepository(this.c).findMatchingFinalization(
      command.record,
      command.disclosure,
      command.preservation,
    )
    if (existing === null || existing instanceof Error) return existing
    try {
      const batches = await this.c.env.DB.batch([
        ...this.c.assertions,
        this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM system_execution_authorizations a JOIN system_cases c ON c.id = a.case_id
          WHERE a.id = ?1 AND a.case_id = ?2 AND a.proposal_digest = ?3
            AND a.granted_to_account_id = ?4 AND a.operation_key = 'system.record.preserve'
            AND a.used_at = ?5 AND c.status = 'executed' AND c.proposal_digest = a.proposal_digest
            AND c.subject_context = 'system' AND c.subject_kind = 'record-preservation'
            AND c.subject_id = ?6 AND c.subject_version = '1'
        ) THEN 1 ELSE json_extract('', '$') END`).bind(
          this.c.authorization.id,
          this.c.authorization.caseId,
          proposal.props.digest.toString(),
          command.record.snapshot.actorAccountId,
          Date.parse(existing.snapshot.finalizedAt),
          existing.snapshot.id,
        ),
      ])
      if (
        batches.length !== this.c.assertions.length + 1 ||
        batches.some((batch) => !batch.success)
      )
        return new Error("record replay execution proof failed")
      return existing
    } catch (cause) {
      return new Error("record replay execution proof failed", { cause })
    }
  }

  async authorize(): Promise<void | Error> {
    try {
      if (this.c.assertions.length === 0) return new Error("record authorization is required")
      const batch = await this.c.env.DB.batch([...this.c.assertions])
      if (batch.length !== this.c.assertions.length || batch.some((result) => !result.success))
        return new Error("record authorization failed")
    } catch (cause) {
      return new Error("record authorization failed", { cause })
    }
  }

  prepareWrite(input: WriteInput): ReadonlyArray<D1PreparedStatement> {
    return [
      ...new PreservedRecordDisclosurePolicyRepository(this.c).preparePublish(
        input.command.disclosure,
        input.policyAudit,
      ),
      ...new AttachmentPreservationRepository(this.c).prepareWrite(
        input.command.preservation,
        input.holdAudit,
      ),
      ...new PreservedRecordRepository(this.c).prepareFinalize(
        input.command.record,
        input.recordAudit,
        input.attachment,
      ),
    ]
  }

  /** 承認済み内容の保全と実行許可の消費を一つのtransactionで確定する。 */
  async executeAuthorized(input: WriteInput): Promise<true | Error> {
    const record = input.command.record.snapshot
    if (
      this.c.assertions.length === 0 ||
      this.c.executionGuards.length === 0 ||
      this.c.authorization.operationKey !== "system.record.preserve" ||
      this.c.authorization.grantedToAccountId !== record.actorAccountId
    )
      return new Error("record execution authorization does not match")
    const proposal = await RecordPreservationProposalValue.create(input.command)
    if (proposal instanceof Error) return proposal
    return new SystemD1AuthorizedExecutionAdapter(this.c).execute({
      authorization: this.c.authorization,
      proposalDigest: proposal.props.digest.toString(),
      executedAt: new Date(record.finalizedAt),
      operationStatements: [
        this.currentExecutionGuard(record.finalizedAt),
        ...this.c.executionGuards,
        this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM system_cases WHERE id = ?1
            AND subject_context = 'system' AND subject_kind = 'record-preservation'
            AND subject_id = ?2 AND subject_version = '1'
        ) THEN 1 ELSE json_extract('', '$') END`).bind(this.c.authorization.caseId, record.id),
        ...this.prepareWrite(input),
        this.currentExecutionGuard(record.finalizedAt),
      ],
    })
  }
  private currentExecutionGuard(finalizedAt: string): D1PreparedStatement {
    return this.c.env.DB.prepare(`WITH evaluation AS (
      SELECT CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AS at
    ) SELECT CASE WHEN EXISTS (
      SELECT 1 FROM evaluation WHERE at >= ?1 AND at < ?2 AND at >= ?3
    ) THEN 1 ELSE json_extract('', '$') END`).bind(
      this.c.authorization.grantedAt.getTime(),
      this.c.authorization.expiresAt.getTime(),
      Date.parse(finalizedAt),
    )
  }
}
