import type { ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Button で表すステータスの色マッピング（web/DESIGN.md）に合わせ、2 値だけを持つ。 */
export type StatusLabelVariant = "secondary" | "destructive"

type Props = {
  variant?: StatusLabelVariant
  /** 隣に並ぶ Button の size。既定はテーブル行で使う `sm`。 */
  size?: "sm" | "default"
  children: ReactNode
}

/**
 * 押せない状態表示。テーブル行や Button・Input と同じ行に置くラベルに使う。
 *
 * 見た目と高さは Button と同じ `buttonVariants` から作るので、同じ size の Button と揃う。
 * 要素は `span` で、フォーカスを受けず、支援技術へボタンとして伝わらない。
 * hover や押下の見た目の変化も出さないよう、pointer イベントを受けない。
 */
export function StatusLabel(props: Props) {
  return (
    <span
      data-slot="status-label"
      className={cn(
        buttonVariants({ variant: props.variant ?? "secondary", size: props.size ?? "sm" }),
        "pointer-events-none",
      )}
    >
      {props.children}
    </span>
  )
}
