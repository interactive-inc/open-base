import { readFormFields, type Template } from "@/components/app/application-types"
import { TextSkeleton } from "@/components/app/data-view"
import type { ApiJsonState } from "@/components/app/use-api-json"

/** テンプレートの読み込みの状態から、項目のキーと名前の対応を作る。読めなかったときはキーのまま出す。 */
export function toPayloadLabels(
  template: ApiJsonState<Template>,
): ReadonlyMap<string, string> | "loading" {
  if (template.kind === "loading") return "loading"
  const fields = template.kind === "ok" ? readFormFields(template.data.schema_json) : []
  return new Map(fields.map((field) => [field.id, field.label]))
}

/**
 * 申請の内容を、項目の名前と値の組で並べる。
 * 項目の名前はテンプレートから引く。読み込み中は `loading` を渡し、キーの代わりに場所取りを出す。
 */
export function PayloadList(props: {
  payload: unknown
  labels: ReadonlyMap<string, string> | "loading"
}) {
  const { labels } = props
  const entries =
    typeof props.payload === "object" && props.payload !== null ? Object.entries(props.payload) : []
  if (entries.length === 0) {
    return <p className="text-sm">入力された項目はありません。</p>
  }

  return (
    <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-sm text-muted-foreground">
            {labels === "loading" ? (
              <TextSkeleton placeholder="項目の名前" label="項目の名前を読み込み中" />
            ) : (
              (labels.get(key) ?? key)
            )}
          </dt>
          <dd className="text-sm break-words whitespace-pre-wrap">{String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}
