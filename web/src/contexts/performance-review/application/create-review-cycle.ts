import { ReviewCycleEntity } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import type { ReviewCommand } from "@/contexts/performance-review/configuration/review-context"
import type { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review-cycle.repository"
import type { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import type { ReviewWorkflowAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-workflow.adapter"

type Context = Readonly<{
  repository: Pick<ReviewCycleRepository, "save">
  access: Pick<ReviewAccessAdapter, "prepare">
  workflow: Pick<ReviewWorkflowAdapter, "prepareCycle">
  accountId: string
  now: () => Date
}>
export class CreateReviewCycle {
  constructor(private readonly c: Context) {}
  async run(
    input: {
      id: string
      name: string
      starts_on: string
      ends_on: string
      goal_workflow: unknown
      evaluation_workflow: unknown
      evaluation_policy?: unknown
    },
    command: ReviewCommand,
  ) {
    const access = await this.c.access.prepare("performance_review:manage")
    const cycle = ReviewCycleEntity.create({
      id: input.id,
      name: input.name,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      evaluation_policy: input.evaluation_policy,
      goals_procedure_key: `review_${input.id.replaceAll("-", "")}_goals`,
      evaluation_procedure_key: `review_${input.id.replaceAll("-", "")}_evaluation`,
      created_by_account_id: this.c.accountId,
      created_at: this.c.now().toISOString(),
    })
    const procedures = this.c.workflow.prepareCycle(cycle, {
      goals: input.goal_workflow,
      evaluation: input.evaluation_workflow,
    })
    return this.c.repository.save(cycle, command, procedures, access.guards)
  }
}
