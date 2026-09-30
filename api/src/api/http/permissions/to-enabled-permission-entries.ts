import { PERMISSION_CATALOG } from "@/api/http/permissions/permission.catalog"
import { resolveDisabledFeatureKeys } from "@/api/http/features/resolve-disabled-feature-keys"

export type Props = {
  enabledOptInApps: string | undefined
  disabledDefaultApps: string | undefined
}

type PermissionEntry = (typeof PERMISSION_CATALOG)[number]

/**
 * 有効な機能の権限だけを返す。無効なAppの権限はロール編集の選択肢から外す。
 * featureKeyを持たない権限は機能ゲートの対象外なので常に残す。
 */
export function toEnabledPermissionEntries(props: Props): ReadonlyArray<PermissionEntry> {
  const disabledFeatureKeys = new Set(
    resolveDisabledFeatureKeys({
      enabledOptInApps: props.enabledOptInApps,
      disabledDefaultApps: props.disabledDefaultApps,
    }),
  )

  return PERMISSION_CATALOG.filter((entry) => {
    if (entry.featureKey === null) {
      return true
    }

    return disabledFeatureKeys.has(entry.featureKey) === false
  })
}
