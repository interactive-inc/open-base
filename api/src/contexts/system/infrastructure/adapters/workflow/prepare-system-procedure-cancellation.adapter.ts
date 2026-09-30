import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** 上位contextの更新と同じD1 batchへ組み込める、所有者限定のSystem Case取消文を作る。 */
export class PrepareSystemProcedureCancellationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepareSystemProcedureCancellation(
    input: Readonly<{ number: number; createdByAccountId: AccountId; cancelledAt: Date }>,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    if (
      !Number.isSafeInteger(input.number) ||
      input.number <= 0 ||
      !Number.isSafeInteger(input.cancelledAt.getTime())
    ) {
      return new Error("invalid System procedure cancellation")
    }

    const currentCase = `SELECT workflow_case.id
    FROM system_proposal_numbers AS number
    JOIN system_proposals AS proposal ON proposal.series_id = number.series_id
    JOIN system_proposal_cases AS link ON link.proposal_id = proposal.id
    JOIN system_cases AS workflow_case ON workflow_case.id = link.case_id
    WHERE number.number = ?1
      AND proposal.created_by_account_id = ?2
      AND proposal.version = (
        SELECT max(latest.version)
        FROM system_proposals AS latest
        WHERE latest.series_id = proposal.series_id
      )
      AND workflow_case.status = 'pending'
    LIMIT 1`
    const cancelledAt = input.cancelledAt.getTime()

    return [
      this.c.env.DB.prepare(
        `UPDATE system_decision_tasks
       SET outcome = 'cancelled', closed_at = ?3
       WHERE case_id = (${currentCase}) AND outcome IS NULL`,
      ).bind(input.number, input.createdByAccountId, cancelledAt),
      this.c.env.DB.prepare(
        `UPDATE system_cases
       SET status = 'cancelled', updated_at = ?3
       WHERE id = (${currentCase}) AND status = 'pending'`,
      ).bind(input.number, input.createdByAccountId, cancelledAt),
      abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
    ]
  }
}
