import {
  ReviewSheetEntity,
  type ReviewGoal,
} from "@/contexts/performance-review/domain/entities/review-sheet.entity"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import type { ReviewCommand } from "@/contexts/performance-review/configuration/review-context"
import type { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import type { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review-cycle.repository"
import type { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"

type Context = Readonly<{
  repository: Pick<ReviewSheetRepository, "save">
  cycles: Pick<ReviewCycleRepository, "find">
  access: Pick<ReviewAccessAdapter, "prepare">
  accountId: string
  employeeId: string
  now: () => Date
}>
export class CreateReviewSheet {
  constructor(private readonly c: Context) {}
  async run(input: { id: string; cycle_id: string; goals: ReviewGoal[] }, command: ReviewCommand) {
    const access = await this.c.access.prepare("performance_review:write")
    const cycle = await this.c.cycles.find(input.cycle_id)
    if (cycle === null) throw new ReviewError(404, "cycle_not_found")
    const sheet = ReviewSheetEntity.create(
      {
        id: input.id,
        cycle_id: input.cycle_id,
        goals: input.goals,
        evaluation_policy: cycle.data.evaluation_policy,
        owner_account_id: this.c.accountId,
        employee_id: this.c.employeeId,
      },
      this.c.now().toISOString(),
    )
    return this.c.repository.save(sheet, 0, command, access.guards)
  }
}
