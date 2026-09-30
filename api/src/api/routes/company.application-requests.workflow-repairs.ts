import {
  resolveCompanyAccountParticipants,
  type CompanyAccountParticipant,
} from "@/api/http/accounts/resolve-company-account-participants"
import { factory } from "@/api/http/factory"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/lib/http/errors"
import { verifyBearer } from "@/api/http/verify-bearer"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { canRepairWorkflow } from "@/api/http/application-requests/lib/can-repair-workflow"
import { systemProposalQuery } from "@/api/http/application-requests/lib/system-application-operation"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

type WorkflowRepair = {
  id: number
  template_code: string
  template_name: string
  applicant_name: string | null
  step_key: string
  round: number
  reason: "snapshot_missing" | "inactive_candidates"
  started_at: string
}

/**
 * 検査対象の pending 案件を全件読み出すための上限。
 * 修復対象かどうかは「現在 task の候補者のうち在籍者数 < 必要承認数」という
 * 案件ごとの検査を通すまで確定せず、SQL の LIMIT / OFFSET へ下ろせない。
 * そのため一覧の limit / offset は検査後の slice で効かせ、読み出しはここで頭打ちにする。
 */
const PENDING_INSPECTION_MAX = 10_000

/** 現在 task が特定できた案件と、その候補 Account ID を保持する検査単位。 */
type InspectionTarget = Readonly<{
  repair: WorkflowRepair
  createdByAccountId: AccountId
  requiredApprovals: number
  requiredParticipants: number
  candidateAccountIds: ReadonlyArray<AccountId>
}>

// @authorization permission - workflow監査とtemplate管理の両権限を要求する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ limit: z.string().optional(), offset: z.string().optional() })),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!canRepairWorkflow(session)) {
      throw new ForbiddenError()
    }
    const queryParameters = c.req.valid("query")
    const limit = toBoundedInt({
      raw: queryParameters.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })
    const offset = toBoundedInt({
      raw: queryParameters.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })
    const now = new Date(c.env.NOW ?? Date.now())
    const query = systemProposalQuery(c)
    const pending = await query.list({
      creatorAccountIds: null,
      actorAccountId: null,
      statuses: ["pending"],
      procedureKey: null,
      createdFrom: null,
      createdTo: null,
      includeCancelled: false,
      sort: "created_at_asc",
      limit: PENDING_INSPECTION_MAX,
      offset: 0,
      at: now,
    })
    if (pending instanceof Error) throw new InternalError("failed to inspect workflow tasks")

    // 1 周目: 案件ごとの task と候補者だけを読み、参加者解決に要る Account ID を集める。
    const targets: InspectionTarget[] = []
    const accountIds: AccountId[] = []
    for (const proposal of pending.proposals) {
      if (proposal.currentTaskKey === null || proposal.currentTaskRound === null) continue

      const tasks = await query.listTasks(proposal.caseId)
      const candidateAccountIds = await query.listTaskCandidateAccountIds({
        caseId: proposal.caseId,
        taskKey: proposal.currentTaskKey,
        round: proposal.currentTaskRound,
        at: now,
      })
      if (tasks instanceof Error || candidateAccountIds instanceof Error) {
        throw new InternalError("failed to inspect workflow reachability")
      }

      const current = tasks.find(
        (task) => task.key === proposal.currentTaskKey && task.round === proposal.currentTaskRound,
      )
      if (current === undefined) continue

      accountIds.push(...candidateAccountIds)
      accountIds.push(proposal.createdByAccountId)
      targets.push({
        repair: {
          id: proposal.number,
          template_code: proposal.procedureKey,
          template_name: proposal.title,
          applicant_name: null,
          step_key: proposal.currentTaskKey,
          round: proposal.currentTaskRound,
          reason: "inactive_candidates",
          started_at:
            proposal.currentTaskOpenedAt?.toISOString() ?? proposal.createdAt.toISOString(),
        },
        createdByAccountId: proposal.createdByAccountId,
        requiredApprovals: current.requiredApprovals,
        requiredParticipants: current.requiredParticipants,
        candidateAccountIds,
      })
    }

    // 候補者と申請者をまとめて 1 回で解決する。案件数に比例したクエリを出さない。
    const participants = await resolveCompanyAccountParticipants(c, accountIds)
    if (participants instanceof Error) {
      throw new InternalError("failed to inspect workflow candidates")
    }

    // 従業員リンクの無い Account は行が返らず Map から欠落する。
    // 引き当て側は空配列として扱い、在籍者数 0 / 申請者名 null という従来の挙動へ揃える。
    const participantsByAccountId = new Map<AccountId, CompanyAccountParticipant[]>()
    for (const participant of participants) {
      const current = participantsByAccountId.get(participant.accountId)
      if (current === undefined) {
        participantsByAccountId.set(participant.accountId, [participant])
        continue
      }

      current.push(participant)
    }

    // 2 周目: 解決済みの参加者だけを見て到達可能性を判定する。順序は 1 周目のまま保つ。
    const repairs: WorkflowRepair[] = []
    for (const target of targets) {
      const reachable = target.candidateAccountIds
        .flatMap((accountId) => participantsByAccountId.get(accountId) ?? [])
        .filter(
          (participant) => participant.status === "ACTIVE" || participant.status === "ON_LEAVE",
        ).length
      if (reachable >= Math.max(target.requiredApprovals, target.requiredParticipants)) continue

      const owners = participantsByAccountId.get(target.createdByAccountId) ?? []
      repairs.push({ ...target.repair, applicant_name: owners.at(0)?.employeeName ?? null })
    }

    return c.json({ data: repairs.slice(offset, offset + limit), total: repairs.length }, 200)
  },
)
