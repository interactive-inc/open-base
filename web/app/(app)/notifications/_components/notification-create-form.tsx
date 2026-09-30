"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import type { NotificationFormState } from "@/app/(app)/notifications/actions"
import { createNotificationAction } from "@/app/(app)/notifications/actions"
import { EmployeeSelect } from "@/components/employee-select"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const initialState: NotificationFormState = { ok: false, error: null }

/** 通知の種別の選択肢。値は api の notificationKindSchema に対応する。 */
const kindOptions = [
  { value: "announcement", label: "お知らせ" },
  { value: "task", label: "タスク" },
  { value: "approval_request", label: "承認依頼" },
  { value: "approval_result", label: "承認結果" },
  { value: "reminder", label: "リマインド" },
]

type Props = {
  employees: ReadonlyArray<{ code: string; name: string }>
}

/**
 * 通知の作成フォーム（特権ロール向け）。宛先・種別・タイトル・本文を native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す。成功時は一覧へ遷移する。
 */
export function NotificationCreateForm(props: Props) {
  const router = useRouter()

  const action = useActionState(
    async (previousState: NotificationFormState, formData: FormData) => {
      const next = await createNotificationAction(previousState, formData)

      if (next.ok) {
        toast.success("通知を作成しました")

        router.push("/notifications")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  return (
    <form action={dispatch}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="notification-recipient-code">宛先</FieldLabel>

          <EmployeeSelect
            id="notification-recipient-code"
            name="recipient_employee_code"
            employees={props.employees}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="notification-kind">種別</FieldLabel>

          <Select name="kind" defaultValue="announcement">
            <SelectTrigger id="notification-kind">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {kindOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="notification-title">タイトル</FieldLabel>

          <Input id="notification-title" name="title" placeholder="お知らせ" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="notification-body">本文</FieldLabel>

          <Textarea id="notification-body" name="body" placeholder="本文を入力" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "通知を作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
