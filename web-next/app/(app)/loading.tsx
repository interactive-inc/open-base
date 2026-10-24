import { Skeleton } from "@/components/ui/skeleton"

/**
 * 保護領域のルートセグメント共通ローディング。本体で直接 await する詳細ページなどで、
 * データ取得中に前画面が固まるのを防ぎ、AppShell 内のコンテンツ領域にスケルトンを出す。
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton />
      <Skeleton className="w-full" />
      <Skeleton className="w-full" />
    </div>
  )
}
