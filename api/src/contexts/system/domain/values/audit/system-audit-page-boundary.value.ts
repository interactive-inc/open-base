type Props = Readonly<{ occurredAtEpochMilliseconds: number; eventId: string }>

const eventIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const encodedPattern = /^(0|-?[1-9][0-9]{0,15})\.([0-9a-f-]{36})$/

/**
 * 監査一覧の続きのページで対象の行を固定する境界。
 * 最初の取得時点で条件に合う最も新しい行の発生時刻とIDを持ち、並び順でそれより後の行を対象から外す。
 */
export class SystemAuditPageBoundaryValue {
  readonly occurredAtEpochMilliseconds: number
  readonly eventId: string

  private constructor(props: Props) {
    this.occurredAtEpochMilliseconds = props.occurredAtEpochMilliseconds
    this.eventId = props.eventId
    Object.freeze(this)
  }

  static from(props: Props): SystemAuditPageBoundaryValue | Error {
    if (
      !Number.isSafeInteger(props.occurredAtEpochMilliseconds) ||
      !eventIdPattern.test(props.eventId)
    )
      return new Error("invalid audit page boundary")

    return new SystemAuditPageBoundaryValue(props)
  }

  /** toString() が書き出した文字列だけを受け付ける。 */
  static parse(text: string): SystemAuditPageBoundaryValue | Error {
    const matched = encodedPattern.exec(text)

    if (matched === null) return new Error("invalid audit page boundary")

    return SystemAuditPageBoundaryValue.from({
      occurredAtEpochMilliseconds: Number(matched[1]),
      eventId: String(matched[2]),
    })
  }

  toString(): string {
    return `${this.occurredAtEpochMilliseconds}.${this.eventId}`
  }
}
