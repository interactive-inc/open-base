/**
 * 閲覧者(viewer)と対象従業員(target)の組織上の関係。スコープ権限の判定材料。
 */
export type EmployeeRelation = {
  isSelf: boolean
  isReport: boolean
  isSameDepartment: boolean
}
