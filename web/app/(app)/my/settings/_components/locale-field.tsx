"use client"

import { useRouter } from "next/navigation"
import { setLocaleAction } from "@/app/(app)/my/settings/actions"
import type { SetLocaleState } from "@/app/(app)/my/settings/actions"
import { useFormAction } from "@/hooks/use-form-action"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Locale } from "@/lib/i18n/locale"

const initialState: SetLocaleState = { ok: true, error: null }

const localeOptions: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
]

type Props = {
  locale: Locale
}

export function LocaleField(props: Props) {
  const router = useRouter()

  // action 完了後に画面の Server Component を再取得して `<html lang>` や辞書に反映する。
  // レンダー中には副作用を起こさない（useEffect は使わない）。
  const [_state, dispatch, isPending] = useFormAction(
    setLocaleAction,
    initialState,
    "表示言語を変更しました",
    { onSuccess: () => router.refresh() },
  )

  function handleValueChange(value: string | null) {
    if (value === null) return

    const formData = new FormData()

    formData.set("locale", value)

    dispatch(formData)
  }

  return (
    <FieldGroup>
      <Field orientation="vertical">
        <FieldContent>
          <FieldTitle id="locale-label">表示言語</FieldTitle>
          <FieldDescription>設定した言語で画面のテキストを表示します。</FieldDescription>
        </FieldContent>

        <Select value={props.locale} onValueChange={handleValueChange} disabled={isPending}>
          <SelectTrigger aria-labelledby="locale-label" className="w-full">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {localeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  )
}
