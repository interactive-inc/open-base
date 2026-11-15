import { ArrowLeftIcon } from "lucide-react"
import { Link, useRouter } from "@void/react"
import type { ComponentType, ReactNode } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Skeleton } from "@/components/ui/skeleton"
import type { ApiJsonState } from "@/components/app/use-api-json"

/** 一つ上の画面へ戻るリンク。画面の先頭に置く。 */
export function BackLink(props: { href: string; children: ReactNode }) {
  return (
    <Link
      href={props.href}
      className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}
    >
      <ArrowLeftIcon data-icon="inline-start" />
      {props.children}
    </Link>
  )
}

/**
 * 同じ一覧の見方（絞り込み）を切り替える。選ぶとその `href` へ移る。選択肢は4つまで。
 * 領域の中の別の画面へ移る並びはここに置かず、サイドバーの子項目（app-shell.tsx）に足す。
 */
export function ViewSwitch(props: {
  label: string
  current: string
  items: ReadonlyArray<{ href: string; label: string }>
}) {
  const router = useRouter()
  return (
    <SegmentedControl
      aria-label={props.label}
      value={props.current}
      onValueChange={(value) => {
        if (value === null || value === props.current) return
        // Voidの外（Storybookとモック）では画面の移動の仕組みが無いので、ふつうの移動にする。
        try {
          void router.visit(value)
        } catch {
          window.location.assign(value)
        }
      }}
    >
      {props.items.map((item) => (
        <SegmentedControlItem key={item.href} value={item.href}>
          {item.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}

/**
 * 画面の見出し。名前を左、その画面全体に効く操作を右の端に置く。
 * 分類や外部へのリンクのように操作でないものは `badges` に渡し、名前の下に並べる。
 * 見出しはページの地の上にあるので、secondaryの部品はカードの色で描く。
 */
export function PageHeader(props: {
  title: ReactNode
  description?: ReactNode
  badges?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 [--secondary:var(--secondary-on-page)]">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        {props.description !== undefined && <p className="text-sm">{props.description}</p>}
        {props.badges !== undefined && <div className="flex flex-wrap gap-2">{props.badges}</div>}
      </div>
      {props.action !== undefined && (
        <div className="flex shrink-0 items-center gap-2">{props.action}</div>
      )}
    </div>
  )
}

/** 読み込みの状態で表示を出し分ける。読み込み中は `fallback`、失敗と権限なしは文を出す。 */
export function Loaded<T>(props: {
  state: ApiJsonState<T>
  fallback?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (props.state.kind === "ok") return <>{props.children(props.state.data)}</>
  if (props.state.kind === "loading") {
    return <>{props.fallback ?? <Skeleton className="h-32 w-full" />}</>
  }
  return (
    <Alert role="status">
      <AlertDescription>
        {props.state.kind === "forbidden"
          ? "表示する権限がありません。"
          : "読み込めませんでした。少し待ってから読み込み直してください。"}
      </AlertDescription>
    </Alert>
  )
}

/** 一件も無いときの表示。カードの面にのせる。次にできることがあれば `action` に置く。 */
export function EmptyState(props: {
  icon: ComponentType
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Card>
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <props.icon />
            </EmptyMedia>
            <EmptyTitle>{props.title}</EmptyTitle>
            <EmptyDescription>{props.description}</EmptyDescription>
          </EmptyHeader>
          {props.action !== undefined && <EmptyContent>{props.action}</EmptyContent>}
        </Empty>
      </CardContent>
    </Card>
  )
}

/**
 * 読み込み中の文字の場所取り。
 *
 * 本物の文字と同じ要素の中に仮の文字を置き、文字を透明にして背景だけを見せる。
 * 文字の大きさと行の高さを親から受け継ぐので、読み込みの前後で高さがずれない。
 * 仮の文字は本文ではないので、CSSの疑似要素で描く。読み上げにもコントラストの検査にも掛からない。
 * 見出しのように名前が要る場所では `label` を読み上げ用に渡す。
 */
export function TextSkeleton({ placeholder, label }: { placeholder: string; label?: string }) {
  return (
    <>
      {label !== undefined && <span className="sr-only">{label}</span>}
      <span
        aria-hidden="true"
        data-placeholder={placeholder}
        className="animate-pulse rounded-sm bg-muted text-transparent select-none before:content-[attr(data-placeholder)]"
      />
    </>
  )
}

/** 一覧の読み込み中に出す、行の形の場所取り。一件ごとにカードを置く一覧の形に合わせる。 */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <Card>
            <CardContent className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                <TextSkeleton placeholder="申請の名前の場所取り" />
              </span>
              <span className="text-xs">
                <TextSkeleton placeholder="申請者と日付の場所取り" />
              </span>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** 日付を「2026年11月14日」の形にする。読めない値はそのまま返す。 */
export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(
    date,
  )
}

/** 日時を「2026年11月14日 9:05」の形にする。読めない値はそのまま返す。 */
export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date)
}

/** その日から今日までの日数。止まっている長さを見せるために使う。 */
export function daysSince(value: string, now: Date = new Date()): number {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}
