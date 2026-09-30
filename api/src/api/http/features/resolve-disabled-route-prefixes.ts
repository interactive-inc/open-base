import {
  optInAppRoutePrefixes,
  defaultAppRoutePrefixes,
} from "@/api/http/features/feature-route-registry"
import { resolveDisabledFeatureKeys } from "@/api/http/features/resolve-disabled-feature-keys"
import type { Props } from "@/api/http/features/resolve-disabled-feature-keys"

/**
 * 環境変数から、無効な機能の API ルート接頭辞一覧を解決する。
 * 機能キーの解決は resolveDisabledFeatureKeys に委ね、ここでは接頭辞へ写すだけにする。
 */
export function resolveDisabledRoutePrefixes(props: Props): ReadonlyArray<string> {
  const disabledPrefixes: Array<string> = []

  for (const featureKey of resolveDisabledFeatureKeys(props)) {
    const routePrefixes = optInAppRoutePrefixes[featureKey] ?? defaultAppRoutePrefixes[featureKey]

    if (routePrefixes !== undefined) {
      disabledPrefixes.push(...routePrefixes)
    }
  }

  return disabledPrefixes
}
