import { z } from "zod"
import { createExecutionAuthorizationId } from "@system/domain/schemas/workflow/execution-authorization-id.schema"
import type { RecordPreservationExecutionContext } from "@system/configuration/record-preservation-execution-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import { recordPreservationIntentSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { FinalizePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/finalize-preserved-record-persistence.adapter"
import { FinalizePreservedRecord } from "@system/application/records/finalize-preserved-record"

type Context = RecordPreservationExecutionContext
type Command = Readonly<{
  authentication: SystemReadAuthentication
  number: number
  proposalDigest: string
}>

/** 承認済みの原記録を、現在の資格と原本一致を条件に一回だけ確定する。 */
export class ExecuteRecordPreservationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: Command) {
    try {
      return await this.finalize(input)
    } catch (cause) {
      return new RecordPreservationExecutionError("unavailable", { cause })
    }
  }

  private async finalize(input: Command) {
    if (
      !z
        .string()
        .regex(/^\S{1,255}$/)
        .safeParse(this.c.source.sourceNamespace).success
    )
      return new RecordPreservationExecutionError("unavailable")
    if (
      !z.number().int().positive().safe().safeParse(input.number).success ||
      !z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .safeParse(input.proposalDigest).success
    )
      return new RecordPreservationExecutionError("invalid")
    const authentication = input.authentication
    const at = this.c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      at,
    )
    if (proof instanceof Error) return new RecordPreservationExecutionError("unavailable")
    if (proof === null || !proof.permissionKeys.has(SystemFeaturePermission.RECORD_PRESERVE.key))
      return new RecordPreservationExecutionError("forbidden")
    const technical = proof.assertions(at)
    if (technical instanceof Error || technical[0] === undefined)
      return new RecordPreservationExecutionError("forbidden")
    const proposal = await new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    }).findByNumber(input.number)
    if (proposal instanceof Error) return new RecordPreservationExecutionError("unavailable")
    if (proposal === null) return new RecordPreservationExecutionError("not_found")
    if (proposal.digest !== input.proposalDigest)
      return new RecordPreservationExecutionError("conflict")
    const intent = recordPreservationIntentSchema.safeParse(JSON.parse(proposal.bodyJson))
    const value = await RecordPreservationProposalValue.restore(JSON.parse(proposal.bodyJson))
    if (!intent.success || value instanceof Error)
      return new RecordPreservationExecutionError("unavailable")
    if (intent.data.actorAccountId !== authentication.accountId)
      return new RecordPreservationExecutionError("forbidden")
    const source = PreservedRecordSourceValue.create(intent.data.source)
    if (source instanceof Error) return new RecordPreservationExecutionError("unavailable")
    if (
      source.props.recordId !== this.c.source.recordId ||
      source.props.ownerContext !== this.c.source.ownerContext ||
      source.props.recordKind !== this.c.source.recordKind ||
      source.props.sourceNamespace !== this.c.source.sourceNamespace
    )
      return new RecordPreservationExecutionError("forbidden")
    const current = await this.c.source.revalidate(source)
    if (current instanceof Error || current.assertions.length === 0)
      return new RecordPreservationExecutionError("conflict")
    const finalization = value.toFinalization({ actorAccountId: authentication.accountId, at })
    if (finalization instanceof Error) return new RecordPreservationExecutionError("conflict")
    const authorization = ExecutionAuthorizationEntity.create({
      id: await createExecutionAuthorizationId("record-preservation", proposal.caseId),
      caseId: proposal.caseId,
      operationKey: "system.record.preserve",
      proposalDigest: proposal.digest,
      grantedToAccountId: authentication.accountId,
      grantedAt: at,
      expiresAt: new Date(at.getTime() + 60_000),
      usedAt: null,
    })
    if (authorization instanceof Error) return new RecordPreservationExecutionError("unavailable")
    const assertions: readonly [D1PreparedStatement, ...D1PreparedStatement[]] = [
      technical[0],
      ...technical.slice(1),
      ...current.assertions,
    ]
    if (proposal.status === "executed") {
      const existing = await new FinalizePreservedRecordPersistenceAdapter({
        env: this.c.env,
        assertions,
        authorization,
        executionGuards: [technical[0]],
      }).find(finalization)
      if (existing === null || existing instanceof Error)
        return new RecordPreservationExecutionError("conflict")
      return { record_id: existing.snapshot.id, finalized_at: existing.snapshot.finalizedAt }
    }
    if (proposal.status !== "approved") return new RecordPreservationExecutionError("conflict")
    const qualification = await this.c.prepareExecution({
      applicationId: proposal.number,
      caseId: proposal.caseId,
      seriesId: proposal.seriesId,
      proposal: value,
      executorAccountId: authentication.accountId,
      executedAt: at,
    })
    if (qualification instanceof Error || qualification[0] === undefined)
      return new RecordPreservationExecutionError("forbidden")
    const completed = await new FinalizePreservedRecord({
      env: this.c.env,
      var: this.c.var,
      persistence: new FinalizePreservedRecordPersistenceAdapter({
        env: this.c.env,
        assertions,
        authorization,
        executionGuards: [qualification[0], ...qualification.slice(1)],
      }),
    }).execute(finalization)
    if (completed instanceof Error) return new RecordPreservationExecutionError("conflict")
    return { record_id: completed.snapshot.id, finalized_at: completed.snapshot.finalizedAt }
  }
}
