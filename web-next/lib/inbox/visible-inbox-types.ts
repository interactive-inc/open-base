import type { InboxCounts } from "@/lib/api/types/inbox-types"
import type { PermissionKey } from "@/lib/api/types/permission-key"

/**
 * 受信箱の種類定義。inbox layout のタブとサイドバーの inbox children が同じ集合になるよう
 * ここを唯一の情報源にする。requiredPermission が未指定の種類は全員に表示する。
 * countKey を持つ種類だけ InboxCounts からバッジ件数を引ける（api の /inbox/counts が返す 5 種）。
 */
export type InboxType = {
  key: string
  featureKey: string | null
  label: string
  href: string
  requiredPermission?: PermissionKey
  countKey?: Exclude<keyof InboxCounts, `${string}_has_more`>
}

export const inboxTypes: ReadonlyArray<InboxType> = [
  {
    key: "applications",
    featureKey: null,
    label: "申請",
    href: "/inbox/applications",
    countKey: "applications",
  },
]

/** 本人の permission で表示可能な受信箱の種類だけに絞り込む。 */
export function visibleInboxTypes(
  permissions: ReadonlyArray<string>,
  disabledFeatures: ReadonlyArray<string>,
): ReadonlyArray<InboxType> {
  const permissionSet = new Set(permissions)
  const disabled = new Set(disabledFeatures)

  return inboxTypes.filter(
    (inboxType) =>
      (inboxType.featureKey === null || !disabled.has(inboxType.featureKey)) &&
      (inboxType.requiredPermission === undefined ||
        permissionSet.has(inboxType.requiredPermission)),
  )
}
