import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import type { PreparedSystemAuditDisclosure } from "@system/infrastructure/adapters/audit/system-audit-disclosure-read.adapter"
import { FindPreservedRecordExecutionProofAdapter } from "@system/infrastructure/adapters/records/find-preserved-record-execution-proof.adapter"
import { PreparePreservedRecordApprovalHistoryAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-approval-history.adapter"
import { PreparePreservedRecordRetentionHistoryAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-retention-history.adapter"
import { PreparePreservedRecordDisclosureHistoryAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-disclosure-history.adapter"
import { PreparePreservedRecordAuditReceiptsAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-audit-receipts.adapter"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>
type Input = Readonly<{
  record: PreservedRecordEntity
  accountId: string
  permissionKeys: ReadonlySet<string>
  at: Date
  auditDisclosure: PreparedSystemAuditDisclosure
}>

/** 原記録の確定根拠・承認・保持・開示履歴・参照先監査を揃え、最終開示前の検査を返す。 */
export class PreparePreservedRecordDossierAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Input) {
    if (this.c.assertions.length === 0) return new Error("record dossier authorization is required")
    const storedRecord = await new PreservedRecordRepository(this.c).find(input.record.snapshot.id)
    if (storedRecord instanceof Error) return storedRecord
    if (
      storedRecord === null ||
      JSON.stringify(storedRecord.snapshot) !== JSON.stringify(input.record.snapshot)
    )
      return new Error("record dossier source does not match stored receipt")
    const execution = await new FindPreservedRecordExecutionProofAdapter(this.c).find(
      input.record.snapshot.id,
    )
    if (execution instanceof Error) return execution
    if (execution === null) return new Error("record execution proof is missing")
    const approval = await new PreparePreservedRecordApprovalHistoryAdapter(this.c).prepare({
      proof: execution,
      accountId: input.accountId,
      permissionKeys: input.permissionKeys,
      at: input.at,
    })
    if (approval instanceof Error) return approval
    const retention = await new PreparePreservedRecordRetentionHistoryAdapter(this.c).prepare(
      input.record,
    )
    if (retention instanceof Error) return retention
    const disclosure = await new PreparePreservedRecordDisclosureHistoryAdapter(this.c).prepare(
      input.record,
    )
    if (disclosure instanceof Error) return disclosure
    const auditIds = [
      input.record.snapshot.auditEventId,
      ...disclosure.policies.map((policy) => policy.auditEventId),
      ...retention.preservations.flatMap((preservation) =>
        preservation.release === null
          ? [preservation.auditEventId]
          : [preservation.auditEventId, preservation.release.auditEventId],
      ),
    ]
    const audits = await new PreparePreservedRecordAuditReceiptsAdapter(this.c).prepare(
      auditIds,
      input.auditDisclosure,
    )
    if (audits instanceof Error) return audits
    const proof = execution.props
    const executionGuard = this.c.env.DB.prepare(`SELECT CASE WHEN
      (SELECT COUNT(*) FROM system_cases WHERE subject_context = 'system'
        AND subject_kind = 'record-preservation' AND subject_id = ?1 AND subject_version = '1'
        AND status = 'executed') = 1
      AND EXISTS (SELECT 1 FROM system_cases c
        JOIN system_proposal_cases link ON link.case_id = c.id
        JOIN system_execution_authorizations a ON a.case_id = c.id
        WHERE c.id = ?2 AND link.proposal_id = ?3 AND a.id = ?4
          AND a.operation_key = 'system.record.preserve' AND a.used_at = ?5
          AND a.proposal_digest = ?6 AND a.granted_to_account_id = ?7)
      THEN 1 ELSE json_extract('{}', 'record_execution_proof_changed') END`).bind(
      input.record.snapshot.id,
      proof.caseId,
      proof.proposalId,
      proof.authorizationId,
      Date.parse(proof.executedAt),
      proof.proposalDigest,
      proof.executedByAccountId,
    )
    return Object.freeze({
      history: Object.freeze({
        record: input.record.snapshot,
        execution: proof,
        approval: {
          proposal: approval.proposal,
          tasks: approval.tasks,
          attestations: approval.attestations,
          candidates: approval.candidates,
          exclusions: approval.exclusions,
          delegations: approval.delegations,
        },
        preservations: retention.preservations,
        disclosurePolicies: disclosure.policies,
        auditReceipts: audits.events,
      }),
      guards: (at: Date) => [
        executionGuard,
        approval.guard(at),
        approval.attestationsGuard,
        approval.candidatesGuard,
        approval.delegationsGuard,
        approval.tasksGuard,
        retention.guard,
        disclosure.guard,
        ...audits.guards,
      ],
    })
  }
}
