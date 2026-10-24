import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import type { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import type { ProposalEntity } from "@system/domain/entities/proposal.entity"
import type { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"

type Input = Readonly<{
  record: PreservedRecordEntity
  initialDisclosure: PreservedRecordDisclosurePolicyEntity
  initialPreservation: AttachmentPreservationEntity
  authorization: ExecutionAuthorizationEntity
  proposal: ProposalEntity
  workflowCase: SystemCaseEntity
}>
type Props = Readonly<{
  recordId: string
  caseId: string
  proposalId: string
  proposalSeriesId: string
  proposalVersion: number
  proposalDigest: string
  authorizationId: string
  executedByAccountId: string
  executedAt: string
}>

/** 保存時の原文・条件を再構成し、実際に消費した実行許可と提案版の対応を証明する。 */
export class PreservedRecordExecutionProofValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static async create(input: Input): Promise<PreservedRecordExecutionProofValue | Error> {
    const record = input.record.snapshot
    const workflowCase = input.workflowCase
    const authorization = input.authorization
    const proposal = input.proposal
    const finalizedAt = Date.parse(record.finalizedAt)
    if (
      workflowCase.status !== "executed" ||
      workflowCase.subject.context !== "system" ||
      workflowCase.subject.kind !== "record-preservation" ||
      workflowCase.subject.id !== record.id ||
      workflowCase.subject.version !== "1" ||
      workflowCase.id !== authorization.caseId ||
      authorization.operationKey !== "system.record.preserve" ||
      authorization.grantedToAccountId !== record.actorAccountId ||
      proposal.createdByAccountId !== record.actorAccountId ||
      workflowCase.createdByAccountId !== proposal.createdByAccountId ||
      authorization.usedAt?.getTime() !== finalizedAt ||
      workflowCase.updatedAt.getTime() !== finalizedAt ||
      proposal.createdAt.getTime() > workflowCase.createdAt.getTime() ||
      workflowCase.createdAt.getTime() > authorization.grantedAt.getTime()
    )
      return new Error("preserved record execution references do not match")
    const intent = await RecordPreservationProposalValue.create({
      record: input.record,
      disclosure: input.initialDisclosure,
      preservation: input.initialPreservation,
    })
    if (intent instanceof Error) return intent
    const digest = intent.props.digest.toString()
    if (
      digest !== proposal.digest ||
      digest !== workflowCase.proposalDigest ||
      digest !== authorization.proposalDigest ||
      intent.props.canonical.toString() !== proposal.bodyJson
    )
      return new Error("preserved record execution content does not match")
    return new PreservedRecordExecutionProofValue(
      Object.freeze({
        recordId: record.id,
        caseId: workflowCase.id,
        proposalId: proposal.id,
        proposalSeriesId: proposal.seriesId,
        proposalVersion: proposal.version,
        proposalDigest: digest,
        authorizationId: authorization.id,
        executedByAccountId: record.actorAccountId,
        executedAt: record.finalizedAt,
      }),
    )
  }
}
