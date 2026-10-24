import { Skeleton } from "@/components/ui/skeleton"

/**
 * リスト/テーブルの非同期 fallback として使う統一スケルトン。
 * 各ページが独自に `placeholders = [0,1,2,3,4].map(...)` していたパターンを共有化する。
 */
type Props = {
  rows?: number
  rowClassName?: string
}

export function ListSkeleton(props: Props) {
  const rows = props.rows ?? 5

  const placeholders = Array.from({ length: rows }, (_, index) => index)

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className={props.rowClassName ?? "w-full"} />
      ))}
    </div>
  )
}
