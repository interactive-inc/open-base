import { z } from "zod"
import { createProposalSeriesIdFromDigest } from "@system/domain/schemas/workflow/proposal-series-id.schema"
import type { RecordPreservationSubmissionContext } from "@system/configuration/record-preservation-submission-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { ProcedureKey } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import {
  recordPreservationRequestSchema,
  recordPreservationIntentSchema,
} from "@system/domain/schemas/records/record-preservation-input.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { StorePreservedRecordContent } from "@system/application/records/store-preserved-record-content"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

type Context = RecordPreservationSubmissionContext
type Reply = Readonly<{
  httpStatus: 200 | 201
  body: Readonly<{ number: number; case_id: string; record_id: string; status: string }>
}>
type Command = Readonly<{
  authentication: SystemReadAuthentication
  procedureKey: ProcedureKey
  conditions: z.infer<typeof recordPreservationRequestSchema>
  revision:
    | Readonly<{ mode: "create"; idempotencyKey: string }>
    | Readonly<{
        mode: "resubmit"
        number: number
        previousVersion: number
        previousDigest: string
      }>
}>

/** 原記録と解決済み資格を固定し、初回提出・再提出・再送を同じ条件で扱う。 */
export class SubmitRecordPreservationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: Command) {
    try {
      return await this.submit(input)
    } catch (cause) {
      return new RecordPreservationSubmissionError("unavailable", { cause })
    }
  }

  private async submit(input: Command): Promise<Reply | RecordPreservationSubmissionError> {
    const authentication = input.authentication
    const sourceScope = this.c.source
    if (
      !z
        .string()
        .regex(/^\S{1,255}$/)
        .safeParse(sourceScope.sourceNamespace).success
    )
      return new RecordPreservationSubmissionError("unavailable")
    if (!recordPreservationRequestSchema.safeParse(input.conditions).success)
      return new RecordPreservationSubmissionError("invalid")
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      this.c.var.now(),
    )
    if (proof instanceof Error)
      return new RecordPreservationSubmissionError("unavailable", { cause: proof })
    if (proof === null || !proof.permissionKeys.has(SystemFeaturePermission.RECORD_PRESERVE.key))
      return new RecordPreservationSubmissionError("forbidden")
    const actor = await sourceScope.authorize()
    if (actor instanceof Error || actor.assertions.length === 0)
      return new RecordPreservationSubmissionError("forbidden")
    const query = new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    })
    const resolveVersion = async () => {
      if (input.revision.mode === "create") {
        if (!z.uuid().safeParse(input.revision.idempotencyKey).success)
          return new RecordPreservationSubmissionError("invalid")
        const identity = CanonicalSystemJsonValue.create({
          operation: `${sourceScope.ownerContext}.record-preservation.request`,
          accountId: authentication.accountId,
          key: input.revision.idempotencyKey,
        })
        if (identity instanceof Error) return new RecordPreservationSubmissionError("invalid")
        const digest = await ProposalDigestValue.create(identity)
        if (digest instanceof Error) return new RecordPreservationSubmissionError("invalid")
        return {
          seriesId: createProposalSeriesIdFromDigest(digest.toString()),
          version: 1,
          supersedesProposalId: null,
        }
      }
      const previous = await query.findByNumber(
        input.revision.number,
        input.revision.previousVersion,
      )
      if (previous instanceof Error) return new RecordPreservationSubmissionError("unavailable")
      if (previous === null) return new RecordPreservationSubmissionError("not_found")
      if (previous.createdByAccountId !== authentication.accountId)
        return new RecordPreservationSubmissionError("forbidden")
      if (
        previous.digest !== input.revision.previousDigest ||
        !["returned", "rejected", "cancelled"].includes(previous.status)
      )
        return new RecordPreservationSubmissionError("conflict")
      const oldIntent = recordPreservationIntentSchema.safeParse(JSON.parse(previous.bodyJson))
      if (!oldIntent.success) return new RecordPreservationSubmissionError("unavailable")
      const source = PreservedRecordSourceValue.create(oldIntent.data.source)
      if (source instanceof Error) return new RecordPreservationSubmissionError("unavailable")
      if (!this.matchesScope(source) || !Number.isSafeInteger(previous.version + 1))
        return new RecordPreservationSubmissionError("conflict")
      return {
        seriesId: previous.seriesId,
        version: previous.version + 1,
        supersedesProposalId: previous.proposalId,
      }
    }
    const revision = await resolveVersion()
    if (revision instanceof Error) return revision
    const replay = async () => {
      const existing = await query.findBySeriesVersion({
        seriesId: revision.seriesId,
        version: revision.version,
        creatorAccountId: authentication.accountId,
      })
      if (existing instanceof Error) return new RecordPreservationSubmissionError("unavailable")
      if (existing === null) return null
      const stored = await RecordPreservationProposalValue.restore(JSON.parse(existing.bodyJson))
      const body = recordPreservationIntentSchema.safeParse(JSON.parse(existing.bodyJson))
      if (stored instanceof Error || !body.success)
        return new RecordPreservationSubmissionError("unavailable")
      const source = PreservedRecordSourceValue.create(body.data.source)
      if (source instanceof Error) return new RecordPreservationSubmissionError("unavailable")
      if (
        existing.supersedesProposalId !== revision.supersedesProposalId ||
        existing.procedureKey !== input.procedureKey ||
        !stored.matchesRequest(input.conditions) ||
        body.data.actorAccountId !== authentication.accountId ||
        !this.matchesScope(source)
      )
        return new RecordPreservationSubmissionError("conflict")
      const guards = proof.assertions(this.c.var.now())
      if (guards instanceof Error) return new RecordPreservationSubmissionError("forbidden")
      const assertions = [...guards, ...actor.assertions]
      const verified = await this.c.env.DB.batch(assertions).catch(() => null)
      if (
        verified === null ||
        verified.length !== assertions.length ||
        verified.some((result) => !result.success)
      )
        return new RecordPreservationSubmissionError("forbidden")
      return {
        number: existing.number,
        case_id: existing.caseId,
        record_id: body.data.recordId,
        status: existing.status,
      }
    }
    const existing = await replay()
    if (existing instanceof Error) return existing
    if (existing !== null) return { httpStatus: 200, body: existing }
    const captured = await sourceScope.capture()
    if (
      captured instanceof Error ||
      captured.assertions.length === 0 ||
      captured.actorAccountId !== authentication.accountId ||
      !this.matchesScope(captured.source)
    )
      return new RecordPreservationSubmissionError("forbidden")
    const stored = await new StorePreservedRecordContent(this.c).execute({
      source: captured.source.props,
      content: captured.content,
      ownerAccountId: authentication.accountId,
      now: this.c.var.now(),
    })
    if (stored instanceof Error) return new RecordPreservationSubmissionError("unavailable")
    const recordId = crypto.randomUUID()
    const proposal = await RecordPreservationProposalValue.fromRequest({
      request: input.conditions,
      recordId,
      source: stored.source,
      actorAccountId: authentication.accountId,
      attachmentId: stored.attachment.id,
      attachmentDigest: stored.attachment.plaintextSha256,
      sourceAuthorizationRef: captured.sourceAuthorizationRef,
      preservationId: crypto.randomUUID(),
      disclosurePolicyId: crypto.randomUUID(),
    })
    if (proposal instanceof Error) return new RecordPreservationSubmissionError("invalid")
    const at = this.c.var.now()
    const task = await this.c.prepareTask({
      procedureKey: input.procedureKey,
      proposal,
      applicantAccountId: authentication.accountId,
      at,
    })
    if (
      task instanceof Error ||
      task.resolved.guards.length === 0 ||
      task.definition.key !== input.procedureKey
    )
      return new RecordPreservationSubmissionError("forbidden")
    const finalization = proposal.toFinalization({ actorAccountId: authentication.accountId, at })
    if (finalization instanceof Error) return new RecordPreservationSubmissionError("invalid")
    const verified = await new VerifyPreservedRecordContentAdapter(this.c).execute(
      finalization.record,
      "pending",
    )
    if (verified instanceof Error) return new RecordPreservationSubmissionError("unavailable")
    const guards = proof.assertions(this.c.var.now())
    if (guards instanceof Error) return new RecordPreservationSubmissionError("forbidden")
    const started = await new StartSystemProcedure({
      writer: new SystemD1WorkflowAdapter({
        env: this.c.env,
        startGuards: [
          ...guards,
          ...captured.assertions,
          ...task.resolved.guards,
          new PrepareAttachmentContentReadGuardAdapter(this.c).prepare(
            verified.attachment,
            at,
            "pending",
          ),
        ],
      }),
    }).run({
      seriesId: revision.seriesId,
      version: revision.version,
      procedureKey: task.definition.key,
      procedureRevision: task.definition.revision,
      body: JSON.parse(proposal.props.canonical.toString()),
      createdByAccountId: authentication.accountId,
      supersedesProposalId: revision.supersedesProposalId,
      createdAt: at,
      firstTask: task.resolved.task,
      subject: { context: "system", kind: "record-preservation", id: recordId, version: "1" },
    })
    if (started instanceof Error) {
      const concurrent = await replay()
      if (concurrent instanceof Error) return concurrent
      if (concurrent !== null) return { httpStatus: 200, body: concurrent }
      return new RecordPreservationSubmissionError("conflict")
    }
    return {
      httpStatus: 201,
      body: {
        number: started.number,
        case_id: started.workflowCase.id,
        record_id: recordId,
        status: "pending",
      },
    }
  }

  private matchesScope(source: PreservedRecordSourceValue): boolean {
    return (
      source.props.sourceNamespace === this.c.source.sourceNamespace &&
      source.props.ownerContext === this.c.source.ownerContext &&
      source.props.recordKind === this.c.source.recordKind &&
      source.props.recordId === this.c.source.recordId
    )
  }
}
