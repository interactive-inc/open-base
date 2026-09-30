import type { OrgMember } from "@/lib/api/types/org-types"

/** 部署コード配列と対応するメンバー取得結果（同じ順序）を、部署コード→メンバー一覧の Map にまとめる。 */
export function toMembersByCode(
  codes: ReadonlyArray<string>,
  memberLists: ReadonlyArray<ReadonlyArray<OrgMember> | Error>,
): ReadonlyMap<string, ReadonlyArray<OrgMember>> {
  const entries = codes.map((code, index) => {
    const members = memberLists[index]
    return [code, members instanceof Error ? [] : members] as const
  })

  return new Map(entries)
}
