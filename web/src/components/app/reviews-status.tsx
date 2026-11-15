import { MessageSquareWarningIcon } from "lucide-react"
import { Link } from "@void/react"
import type { ReactNode } from "react"
import { formatDate } from "@/components/app/data-view"
import { PhaseBar } from "@/components/app/phase-bar"
import {
  employeeText,
  sheetPhases,
  sheetTurn,
  STATUS_TEXT,
  type ReviewViewer,
} from "@/components/app/reviews-model"
import type { ReviewSheet, ReviewStatus } from "@/components/app/reviews-types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/** 戻されたときは注意の色、判断を待っているときは面の色、それ以外は線だけで見せる。 */
const STATUS_VARIANT: Readonly<Record<ReviewStatus, "secondary" | "outline" | "destructive">> = {
  draft: "outline",
  goals_pending: "secondary",
  goals_returned: "destructive",
  goals_rejected: "destructive",
  goals_approved: "outline",
  evaluation_pending: "secondary",
  evaluation_returned: "destructive",
  evaluation_rejected: "destructive",
  finalized: "outline",
  cancelled: "outline",
}

/** 評価シートの状態を短い札で見せる。 */
export function ReviewStatusLabel({ status }: { status: ReviewStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_TEXT[status]}</Badge>
}

/** 目標設定から確定までの段階の帯。 */
export function ReviewPhaseBar({ status }: { status: ReviewStatus }) {
  return <PhaseBar phases={sheetPhases(status)} label="評価の段階" />
}

/**
 * 一覧の一件。誰のシートか、いま誰の番で次に何をするか、状態と段階を一目で見せる。
 * 見出しは一覧の見出し（h2）の下に置く h3。
 */
export function ReviewSheetCard(props: { sheet: ReviewSheet; viewer: ReviewViewer }) {
  const { sheet } = props
  const turn = sheetTurn(sheet, props.viewer)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3 className="break-words">
            <Link href={`/reviews/sheets/${sheet.id}`}>
              {props.viewer === "owner"
                ? "あなたの評価シート"
                : `${employeeText(sheet.employee_id)} の評価シート`}
            </Link>
          </h3>
        </CardTitle>
        <CardDescription>
          {turn.who} · {turn.title} · 更新 {formatDate(sheet.updated_at)}
        </CardDescription>
        <CardAction>
          <ReviewStatusLabel status={sheet.status} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ReviewPhaseBar status={sheet.status} />
      </CardContent>
    </Card>
  )
}

/** 評価シートの一覧。一件ごとにカードを置く。 */
export function ReviewSheetCards(props: {
  sheets: ReadonlyArray<{ sheet: ReviewSheet; viewer: ReviewViewer }>
}) {
  return (
    <ul className="flex flex-col gap-4">
      {props.sheets.map((row) => (
        <li key={row.sheet.id}>
          <ReviewSheetCard sheet={row.sheet} viewer={row.viewer} />
        </li>
      ))}
    </ul>
  )
}

/**
 * シートの一番上に置く、いま誰の番で次に何をするかの表示。
 * 見ている人の番なら札を主の色にする。戻されたときは理由も出す。
 * `children` は段階の帯の下に置く補足（書き込みの案内や、確かめられなかったことの知らせ）。
 */
export function ReviewTurnPanel(props: {
  sheet: ReviewSheet
  viewer: ReviewViewer
  returned: { action: "return" | "reject"; reason: string; created_at: string } | null
  children?: ReactNode
}) {
  const turn = sheetTurn(props.sheet, props.viewer)
  const mine = turn.actor !== "none" && turn.actor === props.viewer
  const showReturned =
    props.returned !== null &&
    ["goals_returned", "goals_rejected", "evaluation_returned", "evaluation_rejected"].includes(
      props.sheet.status,
    )

  return (
    <Card>
      <CardHeader>
        <Badge variant={mine ? "default" : "secondary"}>{turn.who}</Badge>
        <CardTitle>
          <h2 className="text-lg font-semibold">{turn.title}</h2>
        </CardTitle>
        <CardDescription>{turn.description}</CardDescription>
        <CardAction>
          <ReviewStatusLabel status={props.sheet.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showReturned && props.returned !== null && (
          <Alert role="status">
            <MessageSquareWarningIcon />
            <AlertTitle>
              {props.returned.action === "return" ? "差し戻しの理由" : "却下の理由"} ·{" "}
              {formatDate(props.returned.created_at)}
            </AlertTitle>
            <AlertDescription className="break-words whitespace-pre-wrap text-foreground">
              {props.returned.reason}
            </AlertDescription>
          </Alert>
        )}
        <ReviewPhaseBar status={props.sheet.status} />
        {props.children}
      </CardContent>
    </Card>
  )
}
