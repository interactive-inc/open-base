import { verifyBearer } from "@/api/http/verify-bearer"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { HTTPException } from "hono/http-exception"
import type { HonoEnv } from "@/bindings"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import {
  ReviewAccessAdapter,
  REVIEW_COMPLETION_KEYS,
} from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import {
  reviewContext,
  reviewResult,
  reviewIdSchema,
} from "@/contexts/performance-review/interface/http/review-runtime"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"

const factory = createFactory<HonoEnv>()
// @authorization service - 本人または現在の判断資格を持つ評価者にだけ開示する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("param", reviewIdSchema),
  async (c) => {
    const context = reviewContext(c),
      repository = new ReviewSheetRepository(context),
      { id } = c.req.valid("param")
    return c.json(
      await reviewResult(async () => {
        const sheet = await repository.find(id)
        if (sheet === null) throw new HTTPException(404, { message: "sheet_not_found" })
        const access = await new ReviewAccessAdapter(context).read(sheet)
        const proposal =
          sheet.data.approval === null
            ? null
            : await openSystemProposals({
                ...context,
                visibleCompletionOperationKeys: [...REVIEW_COMPLETION_KEYS],
              }).findByNumber(sheet.data.approval.number)
        if (
          sheet.data.approval !== null &&
          (proposal === null ||
            (!(proposal instanceof Error) &&
              (proposal.proposalId !== sheet.data.approval.proposal_id ||
                proposal.caseId !== sheet.data.approval.case_id)))
        )
          throw new HTTPException(503, { message: "approval_reference_invalid" })
        if (proposal instanceof Error)
          throw new HTTPException(503, { message: "approval_unavailable" })
        const target =
          proposal?.status === "pending"
            ? {
                proposal_version: proposal.version,
                proposal_digest: proposal.digest,
                task_key: proposal.currentTaskKey,
                task_round: proposal.currentTaskRound,
              }
            : null
        await repository.verify([...access.guards, repository.guard(id, sheet.data.revision)])
        return {
          ...sheet.data,
          decision_target: target,
          self_evaluation_summary:
            sheet.data.self_assessments.length === 0
              ? null
              : sheet.summarizeAssessments(sheet.data.self_assessments),
        }
      }),
    )
  },
)
