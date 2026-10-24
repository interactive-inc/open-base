import { Suspense } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { PageSizeSelect } from "@/components/page-size-select"
import { Button } from "@/components/ui/button"

/**
 * 一覧画面で使うページ送り。total/limit/offset から件数を計算して、
 * `?page=N` を維持しつつ前後と数ページ分のリンクを描画する。
 * 現在のページ周辺 ±1 だけ表示し、それ以外は省略する単純な実装。
 *
 * pageSizeOptions を渡すと件数セレクタ（10/20/50/100 件）を表示する。
 */
type Props = {
  pathname: string
  total: number
  limit: number
  offset: number
  // ?page= と一緒に維持したい他の searchParams（例: sort）
  extraParams?: Record<string, string | undefined>
  /** 件数セレクタの選択肢。渡すとセレクタを表示する */
  pageSizeOptions?: number[]
}

function buildHref(
  pathname: string,
  page: number,
  extraParams?: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams()

  if (page > 1) {
    search.set("page", String(page))
  }

  if (extraParams !== undefined) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== "") {
        search.set(key, value)
      }
    }
  }

  const queryString = search.toString()

  return queryString === "" ? pathname : `${pathname}?${queryString}`
}

export function TablePagination(props: Props) {
  const totalPages = Math.max(1, Math.ceil(props.total / props.limit))

  const currentPage = Math.floor(props.offset / props.limit) + 1

  if (totalPages <= 1) {
    return <p className="text-xs text-muted-foreground">全 {props.total} 件</p>
  }

  const start = props.offset + 1

  const end = Math.min(props.total, props.offset + props.limit)

  const visiblePages: number[] = []

  for (let page = 1; page <= totalPages; page++) {
    if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
      visiblePages.push(page)
    }
  }

  const canPrev = currentPage > 1

  const canNext = currentPage < totalPages

  return (
    <nav
      aria-label="ページ送り"
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-4">
        <p className="text-xs text-muted-foreground">
          {start}–{end} / 全 {props.total} 件
        </p>

        {props.pageSizeOptions !== undefined ? (
          <Suspense>
            <PageSizeSelect currentSize={props.limit} options={props.pageSizeOptions} />
          </Suspense>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {canPrev ? (
          <Button variant="ghost" size="sm" nativeButton={false}>
            <Link
              href={buildHref(props.pathname, currentPage - 1, props.extraParams)}
              aria-label="前のページ"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">前へ</span>
            </Link>
          </Button>
        ) : (
          <span className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">前へ</span>
          </span>
        )}

        {visiblePages.map((page, index) => {
          const previousPage = visiblePages[index - 1]

          const hasGap = previousPage !== undefined && page - previousPage > 1

          const isActive = page === currentPage

          return (
            <span key={page} className="flex items-center gap-2">
              {hasGap ? <span className="px-2 text-muted-foreground">…</span> : null}

              {isActive ? (
                <Button variant="secondary" size="sm" disabled aria-current="page">
                  {page}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" nativeButton={false}>
                  <Link
                    href={buildHref(props.pathname, page, props.extraParams)}
                    aria-label={`${page} ページ目`}
                  >
                    {page}
                  </Link>
                </Button>
              )}
            </span>
          )
        })}

        {canNext ? (
          <Button variant="ghost" size="sm" nativeButton={false}>
            <Link
              href={buildHref(props.pathname, currentPage + 1, props.extraParams)}
              aria-label="次のページ"
              className="flex items-center gap-2"
            >
              <span className="hidden sm:inline">次へ</span>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <span className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">次へ</span>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  )
}
