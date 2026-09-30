import Link from "next/link"
import { Button } from "@/components/ui/button"

/** 無効化された機能の画面の代わりに表示する案内。表示のみで、強制は api の 404 が担う。 */
export function FeatureDisabledScreen() {
  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">この機能は無効化されています</h1>

        <p className="text-sm text-muted-foreground">
          この環境では管理者がこの機能を無効にしています。利用するには管理者に問い合わせてください。
        </p>
      </div>

      <Button nativeButton={false} render={<Link href="/" />}>
        ホームへ戻る
      </Button>
    </main>
  )
}
