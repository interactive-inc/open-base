/** 従業員一人の画面が読むAPIの経路。画面とloaderで同じものを使う。 */

/** 経路から取り出した（復号済みの）コードを、APIへ渡せる従業員コードにする。読めない値はnull。 */
export function employeeCodeFromPath(value: string): string | null {
  return /^[^\s/]{1,64}$/.test(value) ? value : null
}

/** 基準日の人事状態。基準日が無ければ会社の今日で読む。 */
export function statePath(code: string, asOf: string | null): string {
  const base = `/company/employee-lifecycle/${encodeURIComponent(code)}/state`
  return asOf === null ? base : `${base}?as_of=${asOf}`
}

/** 人事発令の履歴。新しい順に、ページごとに読む。 */
export function eventsPath(code: string, cursor: string | null): string {
  const query = new URLSearchParams({ limit: "50" })
  if (cursor !== null) query.set("cursor", cursor)
  return `/company/employee-lifecycle/${encodeURIComponent(code)}/events?${query.toString()}`
}
