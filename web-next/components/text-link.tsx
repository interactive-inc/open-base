import { ChevronRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * 「〇〇を開く」のような文章型・CTA 型のテキストリンクを統一する。文末に ChevronRight を置く。
 *
 * 一覧テーブルの識別子リンク（従業員名・申請番号など）にはこれを使わない。
 * 行ごとに記号が並んで一覧が読みにくくなるため、そちらは素の `Link` のままにする。
 *
 * 下線は文字だけに掛ける。ChevronRight を span の外に出しているのはそのため。
 */
type Props = {
  href: string
  className?: string
  prefetch?: boolean
  children: ReactNode
}

export function TextLink(props: Props) {
  return (
    <Link
      href={props.href}
      prefetch={props.prefetch}
      className={cn(
        "group/text-link inline-flex w-fit items-center gap-2 text-sm text-primary",
        props.className,
      )}
    >
      <span className="underline-offset-4 group-hover/text-link:underline">{props.children}</span>

      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/40" />
    </Link>
  )
}
