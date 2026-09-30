export type DueEmploymentLifecycleAction = Readonly<{
  sequence: number
  actionId: string
  payloadFingerprint: string
}>

type Input = Readonly<{
  database: D1Database
  /** 発令の記録時刻の下限と上限（epoch秒、両端を含む）。 */
  recordedFrom: number
  recordedUntil: number
  /** この会社営業日までに発効した発令だけを返す。 */
  observedOn: string
  /** 前のページの最後のsequence。最初のページは0。 */
  afterSequence: number
  limit: number
}>

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/u

/**
 * 入社・再入社・退職の効果を持ち、指定した営業日までに発効した人事発令を記録順に返す。
 * 退職は最終在籍日の翌日に発効する。訂正は置換後の種別と発効日で判定し、取消だけの訂正も返す。
 * 業務側は発令tableを直接読まず、受領済みかどうかの判定だけを自分の台帳で行う。
 */
export async function listDueEmploymentLifecycleActions(
  input: Input,
): Promise<ReadonlyArray<DueEmploymentLifecycleAction> | Error> {
  if (
    !Number.isSafeInteger(input.recordedFrom) ||
    input.recordedFrom < 0 ||
    !Number.isSafeInteger(input.recordedUntil) ||
    input.recordedUntil < input.recordedFrom ||
    !Number.isSafeInteger(input.afterSequence) ||
    input.afterSequence < 0 ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 100 ||
    !calendarDatePattern.test(input.observedOn)
  )
    return new Error("invalid employment lifecycle action window")
  try {
    const rows = await input.database
      .prepare(
        `SELECT action.rowid AS sequence, action.id, action.payload_fingerprint
         FROM company_personnel_actions action
         WHERE action.rowid > ?5 AND action.recorded_at >= ?1 AND action.recorded_at <= ?2
           AND (action.kind IN ('hire', 'rehire', 'retired') OR (action.kind = 'corrected' AND json_extract(action.summary_json, '$.replacementKind') IN ('hire', 'rehire', 'retired')))
           AND (CASE
             WHEN action.kind = 'retired' THEN date(action.event_on, '+1 day')
             WHEN action.kind = 'corrected' AND json_extract(action.summary_json, '$.replacementKind') = 'retired' THEN date(json_extract(action.summary_json, '$.replacementEventOn'), '+1 day')
             WHEN action.kind = 'corrected' THEN json_extract(action.summary_json, '$.replacementEventOn')
             ELSE action.event_on END <= ?3
             OR (action.kind = 'corrected' AND json_extract(action.summary_json, '$.replacementEventOn') IS NULL))
         ORDER BY action.rowid LIMIT ?4`,
      )
      .bind(
        input.recordedFrom,
        input.recordedUntil,
        input.observedOn,
        input.limit,
        input.afterSequence,
      )
      .all<{ sequence: number; id: string; payload_fingerprint: string }>()
    if (!rows.success) return new Error("employment lifecycle actions are unavailable")
    const actions: DueEmploymentLifecycleAction[] = []
    for (const row of rows.results) {
      if (
        !Number.isSafeInteger(row.sequence) ||
        row.sequence <= (actions.at(-1)?.sequence ?? input.afterSequence) ||
        typeof row.id !== "string" ||
        row.id.length === 0 ||
        typeof row.payload_fingerprint !== "string" ||
        row.payload_fingerprint.length === 0
      )
        return new Error("employment lifecycle actions are unavailable")
      actions.push({
        sequence: row.sequence,
        actionId: row.id,
        payloadFingerprint: row.payload_fingerprint,
      })
    }
    return Object.freeze(actions)
  } catch (cause) {
    return new Error("employment lifecycle actions are unavailable", { cause })
  }
}
