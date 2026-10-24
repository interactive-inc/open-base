import type { DecisionTaskEntity } from "@system/domain/entities/decision-task.entity"
import type { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import type { HumanAttestationId } from "@system/domain/schemas/workflow/human-attestation-id.schema"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"
import type { SystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"

/** HumanAttestationEntity群をTask snapshotに照合して確定したSystem判断。 */
export class DecisionEntity {
  readonly caseId: SystemCaseId
  readonly taskKey: string
  readonly round: number
  readonly outcome: "approved" | "rejected" | "returned"
  readonly proposalDigest: ProposalDigest
  readonly attestationIds: ReadonlyArray<HumanAttestationId>
  readonly #decidedAtEpochMilliseconds: number

  private constructor(props: {
    task: DecisionTaskEntity
    attestations: ReadonlyArray<HumanAttestationEntity>
    outcome: "approved" | "rejected" | "returned"
    decidedAt: Date
  }) {
    this.caseId = props.task.caseId
    this.taskKey = props.task.key
    this.round = props.task.round
    this.outcome = props.outcome
    this.proposalDigest = props.task.proposalDigest
    this.attestationIds = Object.freeze(props.attestations.map((attestation) => attestation.id))
    this.#decidedAtEpochMilliseconds = props.decidedAt.getTime()
    Object.freeze(this)
  }

  static create(
    task: DecisionTaskEntity,
    attestations: ReadonlyArray<HumanAttestationEntity>,
    decidedAt: Date,
  ): DecisionEntity | InvalidSystemWorkflowError {
    const decidedAtEpochMilliseconds = decidedAt.getTime()

    if (
      !Number.isFinite(decidedAtEpochMilliseconds) ||
      attestations.some(
        (attestation) => attestation.decidedAt.getTime() > decidedAtEpochMilliseconds,
      )
    ) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    const outcome = task.evaluate(attestations)

    if (outcome instanceof InvalidSystemWorkflowError) return outcome
    if (outcome === "pending") return new InvalidSystemWorkflowError("decision_pending")

    return new DecisionEntity({ task, attestations, outcome, decidedAt })
  }

  get decidedAt(): Date {
    return new Date(this.#decidedAtEpochMilliseconds)
  }
}
