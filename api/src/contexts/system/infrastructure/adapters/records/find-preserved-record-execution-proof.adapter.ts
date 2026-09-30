import type { SystemD1Context } from "@system/configuration/system-context"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { PreservedRecordExecutionProofValue } from "@system/domain/values/records/preserved-record-execution-proof.value"
import {
  systemCaseIdSchema,
  systemCaseStatusSchema,
} from "@system/domain/schemas/workflow/system-case.schema"
import {
  proposalDigestSchema,
  systemCaseReferenceSchema,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>
type Row = Readonly<{
  record_json: string
  disclosure_json: string | null
  preservation_json: string | null
  proposal_json: string
  case_json: string
  authorization_json: string
}>
const timestamp = z
  .number()
  .int()
  .nonnegative()
  .transform((value) => new Date(value))
const proposalSchema = z.object({ createdAt: timestamp }).passthrough()
const caseSchema = z.object({
  id: systemCaseIdSchema,
  subject: systemCaseReferenceSchema,
  proposalDigest: proposalDigestSchema,
  createdByAccountId: zAccountId,
  status: systemCaseStatusSchema,
  createdAt: timestamp,
  updatedAt: timestamp,
})
const authorizationSchema = z
  .object({
    grantedAt: timestamp,
    expiresAt: timestamp,
    usedAt: timestamp.nullable(),
  })
  .passthrough()

/** 当初の保全条件と一意の実行済み案件を読み、消費済み許可・提案版との対応を検証する。 */
export class FindPreservedRecordExecutionProofAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(recordId: string): Promise<PreservedRecordExecutionProofValue | null | Error> {
    if (this.c.assertions.length === 0) return new Error("record proof authorization is required")
    try {
      const statements = [
        ...this.c.assertions,
        this.c.env.DB.prepare(`SELECT r.snapshot_json AS record_json,
          d.snapshot_json AS disclosure_json, audit.after_json AS preservation_json,
          json_object('id', p.id, 'seriesId', p.series_id, 'version', p.version,
            'procedureKey', p.procedure_key, 'procedureRevision', p.procedure_revision,
            'bodyJson', p.body_json, 'digest', p.digest, 'createdByAccountId', p.created_by_account_id,
            'supersedesProposalId', p.supersedes_proposal_id, 'createdAt', p.created_at) AS proposal_json,
          json_object('id', c.id, 'subject', json_object('context', c.subject_context,
            'kind', c.subject_kind, 'id', c.subject_id, 'version', c.subject_version),
            'proposalDigest', c.proposal_digest, 'createdByAccountId', c.created_by_account_id,
            'status', c.status, 'createdAt', c.created_at, 'updatedAt', c.updated_at) AS case_json,
          json_object('id', a.id, 'caseId', a.case_id, 'operationKey', a.operation_key,
            'proposalDigest', a.proposal_digest, 'grantedToAccountId', a.granted_to_account_id,
            'grantedAt', a.granted_at, 'expiresAt', a.expires_at, 'usedAt', a.used_at) AS authorization_json
          FROM system_preserved_records r
          LEFT JOIN system_record_disclosure_policies d
            ON d.id = r.disclosure_policy_id AND d.revision = r.disclosure_policy_revision
          LEFT JOIN system_attachment_preservations h ON h.id = r.preservation_id
          LEFT JOIN system_audit_events audit ON audit.event_id = h.created_audit_event_id
          LEFT JOIN system_cases c ON c.subject_context = 'system'
            AND c.subject_kind = 'record-preservation' AND c.subject_id = r.id
            AND c.subject_version = '1' AND c.status = 'executed'
          LEFT JOIN system_proposal_cases link ON link.case_id = c.id
          LEFT JOIN system_proposals p ON p.id = link.proposal_id
          LEFT JOIN system_execution_authorizations a
            ON a.case_id = c.id AND a.operation_key = 'system.record.preserve'
          WHERE r.id = ?1 LIMIT 2`).bind(recordId),
      ]
      const batches = await this.c.env.DB.batch<Row>(statements)
      if (batches.length !== statements.length || batches.some((batch) => !batch.success))
        return new Error("record execution proof lookup failed")
      const rows = batches.at(-1)?.results
      if (!rows) return new Error("record execution proof lookup failed")
      if (rows.length === 0) return null
      if (rows.length !== 1) return new Error("record execution proof is ambiguous")
      const row = rows[0]
      if (!row) return new Error("record execution proof lookup failed")
      return await this.restore(row)
    } catch (cause) {
      return new Error("record execution proof lookup failed", { cause })
    }
  }

  private async restore(row: Row): Promise<PreservedRecordExecutionProofValue | Error> {
    const record = PreservedRecordEntity.create(JSON.parse(row.record_json))
    const initialDisclosure = PreservedRecordDisclosurePolicyEntity.create(
      JSON.parse(row.disclosure_json ?? "null"),
    )
    const initialPreservation = AttachmentPreservationEntity.create(
      JSON.parse(row.preservation_json ?? "null"),
    )
    const proposal = await ProposalEntity.restore(
      proposalSchema.parse(JSON.parse(row.proposal_json)),
    )
    const workflowCase = SystemCaseEntity.create(caseSchema.parse(JSON.parse(row.case_json)))
    const authorization = ExecutionAuthorizationEntity.create(
      authorizationSchema.parse(JSON.parse(row.authorization_json)),
    )
    if (
      record instanceof Error ||
      initialDisclosure instanceof Error ||
      initialPreservation instanceof Error ||
      proposal instanceof Error ||
      workflowCase instanceof Error ||
      authorization instanceof Error
    )
      return new Error("record execution proof contains invalid references")
    return PreservedRecordExecutionProofValue.create({
      record,
      initialDisclosure,
      initialPreservation,
      proposal,
      workflowCase,
      authorization,
    })
  }
}
