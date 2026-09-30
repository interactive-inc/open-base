"use client"

import { EmployeeProfileFields } from "@/components/employee-profile-fields"
import type { EmployeeProfileVersion } from "@/lib/api/types/employee-profile-version"
import { updatePhoneAction } from "@/app/(app)/my/settings/actions"
import type { UpdatePhoneState } from "@/app/(app)/my/settings/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: UpdatePhoneState = { ok: true, error: null }

type Props = {
  phone: string | null
  profile: EmployeeProfileVersion | null
  commandId: string
}

/**
 * 電話番号の登録・変更フィールド。転居などのライフイベント届出で入力補助に使う。
 */
export function PhoneField(props: Props) {
  const [state, dispatch, isPending] = useFormAction(
    updatePhoneAction,
    initialState,
    "電話番号を更新しました",
  )

  if (props.profile === null)
    return <p>人物情報の対応確認が完了するまで電話番号を編集できません。</p>

  return (
    <form action={dispatch}>
      <FieldGroup>
        <Field orientation="vertical">
          <FieldContent>
            <FieldTitle id="phone-label">電話番号</FieldTitle>
            <FieldDescription>
              転居などのライフイベント届出で、入力欄に自動反映されます
            </FieldDescription>
          </FieldContent>

          <div className="flex gap-2">
            <Input
              aria-labelledby="phone-label"
              name="phone"
              defaultValue={props.phone ?? ""}
              maxLength={64}
              placeholder="例: 090-1234-5678"
              className="w-full"
            />
          </div>

          {state.error !== null ? <p className="text-sm text-destructive">{state.error}</p> : null}
        </Field>
        <EmployeeProfileFields
          profile={props.profile}
          commandId={props.commandId}
          reasonId="employee-phone-change-reason"
        />
        <Button type="submit" variant="secondary" disabled={isPending}>
          保存
        </Button>
      </FieldGroup>
    </form>
  )
}
