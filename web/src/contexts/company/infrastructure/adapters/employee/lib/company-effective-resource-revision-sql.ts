/**
 * `alias` が指す company_resource_revisions の版が、有効な履歴に残る条件を返す。
 *
 * 正本の時点参照と同じ規則で、同じ発効日の中では最も新しい版だけを代表にし、訂正のための取消版と、
 * 訂正された版を外す。発効日を直す訂正は訂正元と別の発効日を持つので、版の番号や発効日の新しさだけで
 * 選ぶと訂正元が戻る。利用側はこの条件で候補を絞ってから、発効日と版の番号で一つを選ぶ。
 *
 * `organizationRevision` に会社版を表す SQL 式を渡すと、その会社版までに保存された版と訂正だけで判定する。
 * 渡さない場合は現在までのすべてを使う。候補を会社版で絞るのは利用側の役割とする。
 */
export function companyEffectiveResourceRevisionSql(
  alias: string,
  organizationRevision: string | null = null,
): string {
  const through = (other: string) =>
    organizationRevision === null
      ? ""
      : `AND ${other}.organization_revision <= ${organizationRevision}`
  const sameResource = (other: string) =>
    `${other}.organization_id = ${alias}.organization_id
        AND ${other}.resource_type = ${alias}.resource_type
        AND ${other}.resource_id = ${alias}.resource_id`
  return `NOT (${alias}.state = 'void' AND ${alias}.corrects_revision IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS ${alias}_same_date
      WHERE ${sameResource(`${alias}_same_date`)}
        AND ${alias}_same_date.effective_from = ${alias}.effective_from
        AND ${alias}_same_date.revision > ${alias}.revision ${through(`${alias}_same_date`)}
    )
    AND NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS ${alias}_correction
      WHERE ${sameResource(`${alias}_correction`)}
        AND ${alias}_correction.corrects_revision = ${alias}.revision ${through(`${alias}_correction`)}
    )`
}
