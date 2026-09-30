import {
  optInAppRoutePrefixes,
  defaultAppRoutePrefixes,
} from "@/api/http/features/feature-route-registry"

export type Props = {
  enabledOptInApps: string | undefined
  disabledDefaultApps: string | undefined
}

/** カンマ区切りの機能キーを集合にする。未知のキーは無視する（typo は既定側に倒れる）。 */
function toFeatureKeySet(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0),
  )
}

/**
 * 環境変数から、無効な機能キーの一覧を解決する。
 * opt-in App は既定で無効（ENABLED_OPT_IN_APPS で "all" か有効にするキーを指定する）。
 * default App は既定で有効（DISABLED_DEFAULT_APPS で無効にするキーを指定する）。
 */
export function resolveDisabledFeatureKeys(props: Props): ReadonlyArray<string> {
  const disabledKeys: Array<string> = []

  const enabledRaw = props.enabledOptInApps?.trim() ?? ""

  if (enabledRaw !== "all") {
    const enabledKeys =
      enabledRaw === "" || enabledRaw === "none" ? new Set<string>() : toFeatureKeySet(enabledRaw)

    for (const featureKey of Object.keys(optInAppRoutePrefixes)) {
      if (enabledKeys.has(featureKey) === false) {
        disabledKeys.push(featureKey)
      }
    }
  }

  const disabledRaw = props.disabledDefaultApps?.trim() ?? ""

  if (disabledRaw !== "") {
    const requestedKeys =
      disabledRaw === "all"
        ? new Set(Object.keys(defaultAppRoutePrefixes))
        : toFeatureKeySet(disabledRaw)

    for (const featureKey of Object.keys(defaultAppRoutePrefixes)) {
      if (requestedKeys.has(featureKey)) {
        disabledKeys.push(featureKey)
      }
    }
  }

  return disabledKeys
}
