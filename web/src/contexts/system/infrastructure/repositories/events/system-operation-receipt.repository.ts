import { SystemOperationReceiptEntity } from "@system/domain/entities/system-operation-receipt.entity"
import type { SystemD1Context } from "@system/configuration/system-context"

type Context = SystemD1Context
export type SystemOperationReceiptKey = Readonly<{
  operationKey: string
  scopeKey: string
  commandId: string
}>
type Row = Readonly<{
  operation_key: string
  scope_key: string
  command_id: string
  actor_account_id: string
  actor_principal_id: string
  request_digest: string
  result_json: string
  result_digest: string
  recorded_at: number
}>

/** 完了記録の読取と、業務変更と同じtransactionへ載せる追記文を所有する。 */
export class SystemOperationReceiptRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(
    key: SystemOperationReceiptKey,
    assertions: ReadonlyArray<D1PreparedStatement> = [],
  ): Promise<SystemOperationReceiptEntity | null | Error> {
    try {
      const results = await this.c.env.DB.batch([
        ...assertions,
        this.c.env.DB.prepare(`SELECT operation_key, scope_key, command_id, actor_account_id,
          actor_principal_id, request_digest, result_json, result_digest, recorded_at
          FROM system_operation_receipts WHERE operation_key = ?1 AND scope_key = ?2 AND command_id = ?3`).bind(
          key.operationKey,
          key.scopeKey,
          key.commandId,
        ),
      ])
      const result = results.at(-1)
      if (
        result === undefined ||
        results.length !== assertions.length + 1 ||
        results.some((entry) => !entry.success)
      )
        return new Error("operation receipt is unavailable")
      const row = result.results[0] as Row | undefined
      if (row === undefined) return null
      const receipt = await SystemOperationReceiptEntity.create({
        operationKey: row.operation_key,
        scopeKey: row.scope_key,
        commandId: row.command_id,
        actorAccountId: row.actor_account_id,
        actorPrincipalId: row.actor_principal_id,
        requestDigest: row.request_digest,
        recordedAt: row.recorded_at,
        result: JSON.parse(row.result_json),
      })
      if (receipt instanceof Error) return receipt
      if (receipt.props.resultDigest !== row.result_digest)
        return new Error("operation result digest does not match")
      return receipt
    } catch (cause) {
      return new Error("failed to read operation receipt", { cause })
    }
  }

  prepare(receipt: SystemOperationReceiptEntity): D1PreparedStatement {
    const props = receipt.props
    return this.c.env.DB.prepare(`INSERT INTO system_operation_receipts
      (id, operation_key, scope_key, command_id, actor_account_id, actor_principal_id,
       request_digest, result_json, result_digest, recorded_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`).bind(
      crypto.randomUUID(),
      props.operationKey,
      props.scopeKey,
      props.commandId,
      props.actorAccountId,
      props.actorPrincipalId,
      props.requestDigest,
      props.resultJson,
      props.resultDigest,
      props.recordedAt,
    )
  }
}
