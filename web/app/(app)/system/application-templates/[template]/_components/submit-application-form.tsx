"use client"

import { submitApplicationAction } from "@/app/(app)/system/application-templates/[template]/actions"
import type { SubmitState } from "@/app/(app)/system/application-templates/[template]/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { DynamicFormFields } from "@/components/dynamic-form-fields"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import type { FormSchema } from "@/lib/application/form-schema"

type Props = {
  templateCode: string
  schema: FormSchema
}

const initialState: SubmitState = { ok: false, error: null }

/**
 * 申請提出フォーム。テンプレの schema を読んで入力項目を動的に描画し、
 * 入力結果を payload JSON として Server Action に送る。
 */
export function SubmitApplicationForm(props: Props) {
  const action = useFormAction(submitApplicationAction, initialState, "申請を提出しました")

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="template_code" value={props.templateCode} />

      <DynamicFormFields schema={props.schema} name="payload" />

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || props.schema.fields.length === 0}>
          {isPending ? "提出中..." : "提出する"}
        </Button>
      </div>
    </form>
  )
}
