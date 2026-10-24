import { ChevronRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * カード全体をリンクにする導線を統一する。右下に ChevronRight を置き、押せることを示す。
 * 全ファイルで `<Card className="gap-0 p-0"><Link className="p-4 hover:bg-muted/50">` を
 * 書き散らさないようまとめる。hover 色やカードとリンクの入れ子順の揺れもここに集約する。
 */
type Props = {
  href: string
  /** 内側 Link のレイアウト。flex 方向や最小高さなど、カードごとに異なる部分だけを渡す。 */
  className?: string
  prefetch?: boolean
  children: ReactNode
}

export function CardLink(props: Props) {
  return (
    <Card className="gap-0">
      <Link
        href={props.href}
        prefetch={props.prefetch}
        className={cn("relative p-4 pr-8 transition-colors hover:bg-muted/50", props.className)}
      >
        {props.children}

        <ChevronRight
          aria-hidden="true"
          className="absolute right-3 bottom-3 size-4 text-muted-foreground/40"
        />
      </Link>
    </Card>
  )
}
