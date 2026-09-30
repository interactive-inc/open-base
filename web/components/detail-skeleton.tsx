import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * 詳細ページのローディング表示。Card > CardHeader + CardContent のレイアウトに合わせた構造化スケルトン。
 * 実際のレイアウトに近い形状で CLS（レイアウトシフト）を防ぐ。
 */
type Props = {
  /** 2列グリッドに表示する詳細フィールドの数 */
  fields?: number
  /** ヘッダー右にバッジ型スケルトンを表示する */
  showBadge?: boolean
}

export function DetailSkeleton(props: Props) {
  const fieldCount = props.fields ?? 4

  const fieldPlaceholders = Array.from({ length: fieldCount }, (_, i) => i)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Skeleton />

          {props.showBadge !== false ? <Skeleton /> : null}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fieldPlaceholders.map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton />

              <Skeleton />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
