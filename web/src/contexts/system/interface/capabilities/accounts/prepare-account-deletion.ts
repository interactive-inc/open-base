/** Account本体とSystem証跡は保持し、製品transaction側で認証経路だけを失効させる。 */
export function prepareSystemAccountDeletionStatements(): ReadonlyArray<D1PreparedStatement> {
  return []
}
