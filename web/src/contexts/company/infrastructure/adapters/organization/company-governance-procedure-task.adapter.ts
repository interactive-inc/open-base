import type {
  CompanyGovernanceAuthorityQualification,
  CompanyGovernanceAuthorityResolution,
} from "@/contexts/company/domain/policies/company-governance-authority.policy"
import { CompanyGovernanceAuthorityError } from "@/contexts/company/domain/errors"
import type { StartSystemProcedureTask } from "@system/domain/policies/decision-task.policy"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

type Command = Readonly<{
  resolution: CompanyGovernanceAuthorityResolution
  criterionIndex: number
  taskKey: string
  openedAt: Date
  dueAt: Date | null
}>

type Context = Readonly<{ evidenceContext: "company" }>

/** Companyの責務snapshotを、意味を失わないSystem判断Taskへ変換する。 */
export class CompanyGovernanceProcedureTaskAdapter {
  constructor(private readonly c: Context = { evidenceContext: "company" }) {
    Object.freeze(this)
  }

  async prepare(
    command: Command,
  ): Promise<StartSystemProcedureTask | CompanyGovernanceAuthorityError> {
    if (
      !Number.isSafeInteger(command.criterionIndex) ||
      command.criterionIndex < 0 ||
      command.taskKey.length < 1 ||
      command.taskKey.length > 100 ||
      !Number.isFinite(command.openedAt.getTime()) ||
      (command.dueAt !== null &&
        (!Number.isFinite(command.dueAt.getTime()) ||
          command.dueAt.getTime() < command.openedAt.getTime()))
    ) {
      return this.invalid()
    }

    const candidates = command.resolution.candidates.flatMap((candidate) => {
      const qualifications = candidate.qualifications.filter(
        (qualification) => qualification.criterionIndex === command.criterionIndex,
      )
      return qualifications.length === 0 ? [] : [{ candidate, qualifications }]
    })
    if (candidates.length === 0) return this.invalid()

    const collective = this.resolveCollectiveDecision(
      candidates.flatMap((candidate) => candidate.qualifications),
    )
    if (collective instanceof CompanyGovernanceAuthorityError) return collective
    if (
      collective !== null &&
      (collective.votingMemberCount < candidates.length ||
        collective.quorumRequired > candidates.length ||
        collective.approvalRequired > candidates.length)
    ) {
      return this.invalid()
    }

    const taskCandidates: StartSystemProcedureTask["candidates"][number][] = []
    for (const value of candidates) {
      const accountId = zAccountId.safeParse(value.candidate.accountId)
      if (!accountId.success) return this.invalid()
      const evidence = CanonicalSystemJsonValue.create({
        schemaVersion: command.resolution.snapshot.schemaVersion,
        source: command.resolution.snapshot.source,
        asOf: command.resolution.snapshot.asOf,
        organizationRevision: command.resolution.snapshot.organizationRevision,
        criterionIndex: command.criterionIndex,
        employeeId: value.candidate.employeeId,
        accountId: value.candidate.accountId,
        qualifications: value.qualifications,
      })
      if (evidence instanceof Error) return this.invalid()
      const digest = await ProposalDigestValue.create(evidence)
      if (digest instanceof Error) return this.invalid()
      taskCandidates.push({
        accountId: accountId.data,
        source: "primary",
        evidenceContext: this.c.evidenceContext,
        evidenceKind: "governance-authority",
        evidenceId: `${command.resolution.snapshot.organizationRevision}:${command.criterionIndex}:${value.candidate.accountId}`,
        evidenceVersion: String(command.resolution.snapshot.organizationRevision),
        eligibilityDigest: digest.toString(),
        eligibleFrom: null,
        resolvedAt: command.openedAt,
      })
    }

    const excludedAccountIds = []
    for (const exclusion of command.resolution.exclusions) {
      const accountId = zAccountId.safeParse(exclusion.accountId)
      if (!accountId.success) return this.invalid()
      excludedAccountIds.push(accountId.data)
    }
    const delegationAllowed = candidates.every((candidate) =>
      candidate.qualifications.every((qualification) => qualification.delegationAllowed),
    )

    return {
      key: command.taskKey,
      requiredApprovals: collective?.approvalRequired ?? 1,
      requiredParticipants: collective?.quorumRequired ?? 1,
      negativeDecisionRule: collective === null ? "any-reject" : "approval-impossible",
      delegationPolicy: delegationAllowed ? "allowed" : "forbidden",
      returnPolicy: collective === null ? "allowed" : "forbidden",
      openedAt: command.openedAt,
      dueAt: command.dueAt,
      candidates: taskCandidates,
      excludedAccountIds,
    }
  }

  private resolveCollectiveDecision(
    qualifications: ReadonlyArray<CompanyGovernanceAuthorityQualification>,
  ):
    | CompanyGovernanceAuthorityQualification["collectiveDecision"]
    | CompanyGovernanceAuthorityError {
    const collectiveQualifications = qualifications.filter(
      (
        qualification,
      ): qualification is CompanyGovernanceAuthorityQualification & {
        collectiveDecision: NonNullable<
          CompanyGovernanceAuthorityQualification["collectiveDecision"]
        >
      } => qualification.collectiveDecision !== null,
    )
    if (collectiveQualifications.length === 0) return null
    const assignmentIds = new Set(qualifications.map((qualification) => qualification.assignmentId))
    if (
      collectiveQualifications.length !== qualifications.length ||
      assignmentIds.size !== 1 ||
      collectiveQualifications.some(
        (qualification) =>
          JSON.stringify(qualification.collectiveDecision) !==
          JSON.stringify(collectiveQualifications[0]?.collectiveDecision),
      )
    ) {
      return this.invalid()
    }
    return collectiveQualifications[0]?.collectiveDecision ?? this.invalid()
  }

  private invalid(): CompanyGovernanceAuthorityError {
    return new CompanyGovernanceAuthorityError("governance_authority_task_invalid")
  }
}
