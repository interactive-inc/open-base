import { PowerOffIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { BusinessFeature, FeatureAvailability } from "@/components/app/business-types"
import { RowsSkeleton } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/** 配備で無効になっている機能の一覧を読む。 */
export function useFeatures(initial?: ApiJsonState<FeatureAvailability>) {
  return useApiJson<FeatureAvailability>("/company/features", initial)
}

/** 機能が無効と分かっているときだけ true。読めないときは API の応答に判断を任せる。 */
export function isFeatureDisabled(
  features: ApiJsonState<FeatureAvailability>,
  feature: BusinessFeature,
): boolean {
  return features.kind === "ok" && features.data.disabled_features.includes(feature)
}

/** 機能が無効なときの表示。失敗ではなく配備の状態なので、読み込みの失敗と同じく静かな通知にする。 */
export function FeatureDisabled({ name }: { name: string }) {
  return (
    <Alert role="status">
      <PowerOffIcon />
      <AlertTitle>{name}の機能は有効になっていません</AlertTitle>
      <AlertDescription>
        使うには、管理者にこの機能を有効にするよう依頼してください。
      </AlertDescription>
    </Alert>
  )
}

/**
 * 機能が有効なときだけ中身を出す。
 * 無効と分かれば案内を出し、中身の読み込みを始めない。一覧を読めないときは中身に任せる。
 */
export function FeatureGate(props: {
  features: ApiJsonState<FeatureAvailability>
  feature: BusinessFeature
  name: string
  fallback?: ReactNode
  children: ReactNode
}) {
  if (props.features.kind === "loading") return <>{props.fallback ?? <RowsSkeleton />}</>
  if (isFeatureDisabled(props.features, props.feature)) return <FeatureDisabled name={props.name} />
  return <>{props.children}</>
}
