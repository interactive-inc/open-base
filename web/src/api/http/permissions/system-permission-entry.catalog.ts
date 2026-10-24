import type { SYSTEM_PERMISSION_KEYS } from "@system/domain/catalogs/iam/system-permission-key.catalog"

type PermissionEntry = {
  key: (typeof SYSTEM_PERMISSION_KEYS)[number]
  category: string
  featureKey: null
  description: string
}

/**
 * System IAM最小核の表示メタデータ。
 * Systemのcontextはlockで固定するため、表示用のメタデータだけをここが持つ。
 * System権限は機能ゲートで止められないので featureKey は常に null にする。
 */
export const SYSTEM_PERMISSION_ENTRIES = [
  {
    key: "iam:read",
    category: "iam",
    featureKey: null,
    description: "IAM設定と割当を閲覧する",
  },
  {
    key: "iam:write",
    category: "iam",
    featureKey: null,
    description: "IAM設定と割当を変更する",
  },
  {
    key: "system:admin",
    category: "system",
    featureKey: null,
    description: "System全体を管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
