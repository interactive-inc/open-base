import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  id: string
  companyRevision: number
  resourceRevision: number
  commandId: string
  effectiveFrom: string
  effectiveTo: string | null
  isCancellation?: boolean
}

/** 確認した版と再送キーを固定し、期間と判断理由を明示する。 */
export function GradeRevisionFields(props: Props) {
  return (
    <>
      <input type="hidden" name="gradeId" value={props.id} />
      <input type="hidden" name="companyRevision" value={props.companyRevision} />
      <input type="hidden" name="resourceRevision" value={props.resourceRevision} />
      <input type="hidden" name="commandId" value={props.commandId} />
      <Field>
        <FieldLabel htmlFor={`${props.commandId}-from`}>
          {props.isCancellation ? "取消の発効日" : "有効開始日"}
        </FieldLabel>
        <Input
          id={`${props.commandId}-from`}
          name="effectiveFrom"
          type="date"
          defaultValue={props.effectiveFrom}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${props.commandId}-to`}>有効終了日（任意）</FieldLabel>
        <Input
          id={`${props.commandId}-to`}
          name="effectiveTo"
          type="date"
          defaultValue={props.effectiveTo ?? ""}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${props.commandId}-reason`}>変更理由</FieldLabel>
        <Textarea id={`${props.commandId}-reason`} name="reason" required maxLength={2000} />
      </Field>
    </>
  )
}
