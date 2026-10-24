export type ManagementDashboardRanges = {
  /** 当月の YYYY-MM。like 'YYYY-MM%' 前方一致に使う。 */
  monthPrefix: string
  /** 直近 30 日の下限日 YYYY-MM-DD(基準日を含む 30 日前)。 */
  since: string
}

/** ISO 文字列から日付部分(YYYY-MM-DD)を取り出す。 */
function toDatePart(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * 経営ダッシュボードの集計期間を基準時刻から導く。当月の前方一致プレフィックスと
 * 直近 30 日の下限日を返す。計算は日付文字列のみで行い、タイムゾーンは UTC 基準。
 */
export function toManagementDashboardRanges(nowIso: string): ManagementDashboardRanges {
  const now = new Date(nowIso)

  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  return {
    monthPrefix: nowIso.slice(0, 7),
    since: toDatePart(since.toISOString()),
  }
}
