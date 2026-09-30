import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = { title: "ページが見つかりません" }

/** 保護領域内で notFound() が呼ばれた場合の 404 ページ。 */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">ページが見つかりません</h1>

        <p className="text-sm text-muted-foreground">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
      </div>

      <Button nativeButton={false} render={<Link href="/" />}>
        ダッシュボードへ戻る
      </Button>
    </div>
  )
}
