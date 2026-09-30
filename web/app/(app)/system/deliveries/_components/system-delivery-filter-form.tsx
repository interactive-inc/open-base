import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  kind: string
  status: string | null
}

const kindOptions = [
  { value: "job", label: "ジョブ" },
  { value: "outbox", label: "送信箱" },
]

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "queued", label: "待機" },
  { value: "leased", label: "実行中" },
  { value: "succeeded", label: "成功" },
  { value: "dead_letter", label: "dead letter" },
]

/**
 * 配信一覧の絞り込み。api が kind を必須にするので「すべて」は置かず、
 * ジョブと送信箱のどちらかを必ず選ばせる。
 */
export function SystemDeliveryFilterForm(props: Props) {
  return (
    <form method="get" action="/system/deliveries">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-48">
            <Field className="w-full">
              <FieldLabel htmlFor="system-delivery-kind">種別</FieldLabel>

              <NativeSelect
                id="system-delivery-kind"
                name="kind"
                defaultValue={props.kind}
                className="w-full"
              >
                {kindOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="sm:w-48">
            <Field className="w-full">
              <FieldLabel htmlFor="system-delivery-status">状態</FieldLabel>

              <NativeSelect
                id="system-delivery-status"
                name="status"
                defaultValue={props.status ?? ""}
                className="w-full"
              >
                {statusOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Button type="submit">絞り込み</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
