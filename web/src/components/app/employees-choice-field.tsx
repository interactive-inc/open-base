import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type Choice = { value: string; label: string }

/**
 * 決まった選択肢から一つを選ぶ欄。値が空文字のときは何も選んでいない。
 * 従業員の画面で、状態や部署を選んで絞り込むために使う。
 */
export function ChoiceField(props: {
  label: string
  choices: ReadonlyArray<Choice>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <Select
        items={props.choices.map((choice) => ({ value: choice.value, label: choice.label }))}
        value={props.value === "" ? null : props.value}
        onValueChange={(value) => props.onChange(typeof value === "string" ? value : "")}
        placeholder="選んでください"
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
