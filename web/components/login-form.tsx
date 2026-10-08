"use client"

import { Eye, EyeOff } from "lucide-react"
import { useActionState, useEffect, useState } from "react"
import { loginAction } from "@/lib/auth/login-action"
import type { LoginState } from "@/lib/auth/login-action"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useTranslator } from "@/lib/i18n/use-translator"

const initialState: LoginState = { ok: false, error: null }

/**
 * メール + パスワードでサインインするフォーム。`useActionState` で `loginAction` を呼び、
 * 成功時は Server Action 内で cookie を立て、現在の error boundary を再描画する。
 */
type Props = {
  onAuthenticated: () => void
}

export function LoginForm(props: Props) {
  const t = useTranslator()

  const action = useActionState(loginAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (state.ok) {
      props.onAuthenticated()
    }
  }, [props.onAuthenticated, state.ok])

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="login-email">{t("メールアドレス")}</FieldLabel>

          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="login-password">{t("パスワード")}</FieldLabel>

          <InputGroup>
            <InputGroupInput
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
            />

            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t("パスワードを隠す") : t("パスワードを表示")}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? t("ログイン中…") : t("ログイン")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
