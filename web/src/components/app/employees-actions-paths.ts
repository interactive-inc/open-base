/** 人事発令の画面が読むAPIの経路。画面とloaderで同じものを使う。 */

/** 確定した人事発令。記録の新しい順に、ページごとに読む。 */
export function actionsPath(cursor: string | null): string {
  const query = new URLSearchParams({ limit: "25" })
  if (cursor !== null) query.set("cursor", cursor)
  return `/company/personnel-actions?${query.toString()}`
}

/** 承認を申請した人事発令。新しい順に最大100件。 */
export const REQUESTS_PATH = "/company/personnel-action-requests?limit=100"
