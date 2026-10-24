import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** 承認済みCaseの一回限り実行許可と下位contextの変更を同じD1 batchへ閉じる。 */
export class SystemD1AuthorizedExecutionAdapter {
  constructor(private readonly c: Context) {}

  async execute(
    input: Readonly<{
      authorization: ExecutionAuthorizationEntity
      proposalDigest: ProposalDigest
      executedAt: Date
      operationStatements: ReadonlyArray<D1PreparedStatement>
      completionStatements?: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<true | Error> {
    const used = input.authorization.use(input.proposalDigest, input.executedAt)
    if (used instanceof Error) return used
    const database = this.c.env.DB

    try {
      await database.batch([
        database
          .prepare(
            `INSERT INTO system_execution_authorizations
               (id, case_id, operation_key, proposal_digest, granted_to_account_id,
                granted_at, expires_at, used_at)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL
             WHERE EXISTS (
               SELECT 1 FROM system_accounts WHERE id = ?5 AND status = 'active'
             )`,
          )
          .bind(
            input.authorization.id,
            input.authorization.caseId,
            input.authorization.operationKey,
            input.authorization.proposalDigest,
            input.authorization.grantedToAccountId,
            input.authorization.grantedAt.getTime(),
            input.authorization.expiresAt.getTime(),
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        ...input.operationStatements,
        database
          .prepare(
            `UPDATE system_execution_authorizations
             SET used_at = ?2
             WHERE id = ?1 AND used_at IS NULL
               AND proposal_digest = ?3
               AND granted_at <= ?2 AND expires_at > ?2`,
          )
          .bind(used.id, used.usedAt?.getTime() ?? -1, input.proposalDigest),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `UPDATE system_cases
             SET status = 'executed', updated_at = ?3
             WHERE id = ?1 AND status = 'approved' AND proposal_digest = ?2`,
          )
          .bind(used.caseId, input.proposalDigest, input.executedAt.getTime()),
        abortWhenPreviousStatementChangedNoRows(database),
        ...(input.completionStatements ?? []),
      ])
      return true
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to execute authorized System operation", { cause })
    }
  }
}
