import { type ApplicationError, type ConflictError, UnavailableError } from "@/lib/errors"

export type GuardedSaveFailure = Readonly<{
  database: D1Database
  /** 保存のbatchに含めた検査文。権限、判断資格、書込み停止などの前提条件を表す。 */
  guards: ReadonlyArray<D1PreparedStatement>
  /** 保存前に確認した記録と案件の状態が、今も同じであるか。 */
  unchanged: () => Promise<boolean>
  /** 前提条件が変わっていた場合に返す競合。 */
  conflict: ConflictError
  /** 前提条件が変わっていない場合に返す、再送できる失敗の識別子。 */
  unavailableCode: string
  cause: unknown
}>

/**
 * 検査文を含む保存batchの失敗を、前提条件の変化による競合と、監査や保存先の障害に分ける。
 * 保存後に検査文を単独で再評価し、記録と案件の状態も変わっていなければ、失敗の原因は
 * 確認した前提条件ではない。その場合は再送できる503として返し、409を本当の競合だけに使う。
 * 再評価できない場合は、再送で結果が変わると断定できないため競合として扱う。
 */
export async function classifyGuardedSaveFailure(
  failure: GuardedSaveFailure,
): Promise<ApplicationError> {
  if (failure.guards.length > 0) {
    try {
      const results = await failure.database.batch([...failure.guards])
      if (results.length !== failure.guards.length || results.some((result) => !result.success))
        return failure.conflict
    } catch {
      return failure.conflict
    }
  }
  let unchanged: boolean
  try {
    unchanged = await failure.unchanged()
  } catch {
    return failure.conflict
  }
  if (!unchanged) return failure.conflict
  return new UnavailableError(
    "保存できませんでした。時間をおいて同じ操作を再送してください",
    failure.unavailableCode,
    { cause: failure.cause },
  )
}
