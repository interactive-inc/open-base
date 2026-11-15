import { HistoryIcon } from "lucide-react"
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  formatCalendarDate,
  periodStatus,
  type PeriodStatus,
} from "@/components/app/organization-types"

const PERIOD: Readonly<Record<PeriodStatus, { text: string; variant: "secondary" | "outline" }>> = {
  scheduled: { text: "予約", variant: "outline" },
  current: { text: "有効", variant: "secondary" },
  ended: { text: "終了", variant: "outline" },
}

/** 有効期間が基準日から見て、予約・有効・終了のどれかを札で見せる。 */
export function PeriodBadge(props: { from: string; to: string | null; on: string }) {
  const item = PERIOD[periodStatus(props.from, props.to, props.on)]
  return <Badge variant={item.variant}>{item.text}</Badge>
}

/** 違いを示す札。今の姿と比べて変わったところに付け、期間の札より目立たせる。 */
export function ChangeMark({ children }: { children: string }) {
  return <Badge>{children}</Badge>
}

/**
 * 過去の姿を見るための基準日。空なら今の姿を見せる。
 * 過去の日を選んでいるあいだは、今の姿ではないことを知らせ、今の姿へ戻す操作を添える。
 */
export function AsOfPicker(props: {
  value: string
  today: string
  onChange: (value: string) => void
  description: string
}) {
  const past = props.value !== "" && props.value !== props.today
  return (
    <div className="flex flex-col gap-4">
      {/* 幅を狭めるのは日付の入力欄だけ。説明の文は横いっぱいに使い、細かく折り返さない。 */}
      <Field name="asOf">
        <FieldLabel>基準日</FieldLabel>
        <Input
          type="date"
          className="max-w-56"
          value={props.value}
          max="9999-12-31"
          onValueChange={(value) => props.onChange(value)}
        />
        <FieldDescription>{props.description}</FieldDescription>
      </Field>
      {past && (
        <Alert role="status">
          <HistoryIcon aria-hidden="true" />
          <AlertDescription>
            {formatCalendarDate(props.value)}時点の姿です。今と違うところに印を付けています。
          </AlertDescription>
          <AlertAction>
            <Button variant="secondary" size="xs" onClick={() => props.onChange("")}>
              今の姿に戻す
            </Button>
          </AlertAction>
        </Alert>
      )}
    </div>
  )
}
