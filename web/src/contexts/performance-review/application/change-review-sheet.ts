import type { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import type { ReviewWorkflowAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-workflow.adapter"
import type { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import type { ReviewCommand } from "@/contexts/performance-review/configuration/review-context"
import type { ReviewSheetCommandInput } from "@/contexts/performance-review/domain/values/review-command.value"
import { ReviewError } from "@/contexts/performance-review/domain/errors"

type Context = Readonly<{
  repository: Pick<ReviewSheetRepository, "find" | "replay" | "save" | "verify" | "guard">
  workflow: Pick<ReviewWorkflowAdapter, "submit" | "decide" | "cancel">
  access: Pick<ReviewAccessAdapter, "prepare" | "read">
  accountId: string
  now: () => Date
}>

/** 業務の状態遷移を検証し、承認時のtransactionをSystemへの接続portへ渡す。 */
export class ChangeReviewSheet {
  constructor(private readonly c: Context) {}
  async run(id: string, input: ReviewSheetCommandInput, command: ReviewCommand) {
    const sheet = await this.c.repository.find(id)
    if (sheet === null) throw new ReviewError(404, "sheet_not_found")
    const access = await this.c.access.prepare(
      input.operation === "decide" ? "performance_review:decide" : "performance_review:write",
    )
    if (input.operation !== "decide" && sheet.data.owner_account_id !== this.c.accountId)
      throw new ReviewError(403, "sheet_owner_required")
    const replay = await this.c.repository.replay(command)
    if (replay !== null) {
      const read = await this.c.access.read(sheet)
      await this.c.repository.verify([
        ...read.guards,
        this.c.repository.guard(sheet.data.id, sheet.data.revision),
      ])
      return replay
    }
    if (sheet.data.revision !== input.expected_revision)
      throw new ReviewError(409, "review_revision_conflict")
    const at = this.c.now().toISOString()
    switch (input.operation) {
      case "revise_goals":
        return this.c.repository.save(
          sheet.reviseGoals(input.goals, at),
          input.expected_revision,
          command,
          access.guards,
        )
      case "reopen_goals":
        return this.c.repository.save(
          sheet.reopenGoals(at),
          input.expected_revision,
          command,
          access.guards,
        )
      case "self_evaluate":
        return this.c.repository.save(
          sheet.selfEvaluate(input.assessments, at),
          input.expected_revision,
          command,
          access.guards,
        )
      case "submit_goals":
        return this.c.workflow.submit(sheet, "goals", command, access.guards)
      case "submit_evaluation":
        return this.c.workflow.submit(sheet, "evaluation", command, access.guards)
      case "decide":
        return this.c.workflow.decide(sheet, input, command, access.guards)
      case "cancel":
        return this.c.workflow.cancel(sheet, command, access.guards)
    }
  }
}
