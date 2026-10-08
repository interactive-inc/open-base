"use client"

import { LoginForm } from "@/components/login-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslator } from "@/lib/i18n/use-translator"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Props = {
  onAuthenticated?: () => void
}

/**
 * 未認証の保護領域または AuthError の root error boundary が、現在の URL のまま表示する
 * ログイン画面。サインイン後は呼び出し元の reset、または現在の route の refresh で再描画する。
 *
 * ビルド時環境変数でログイン手段を出し分ける:
 * - NEXT_PUBLIC_IDENTITY_LOGIN_URL … 設定時、PKCEを開始する内部routeへの
 *   ログインボタンを表示する（値自体は公開provider URLとして使わない）
 * - NEXT_PUBLIC_PASSWORD_LOGIN_HIDDEN="1" … パスワードフォームを隠す。
 *   ただし NEXT_PUBLIC_IDENTITY_LOGIN_URL が無い場合はロックアウト防止のため隠さない
 * - NEXT_PUBLIC_LOGIN_HIDDEN="1" … フォームもボタンも出さずタイトルだけ表示する。
 *   ログインを CLI など別経路に限定するデプロイ向け。タイトルは NEXT_PUBLIC_APP_NAME
 */
export function LoginPage(props: Props) {
  const t = useTranslator()
  const router = useRouter()

  const onAuthenticated = props.onAuthenticated ?? (() => router.refresh())

  const loginHidden = process.env.NEXT_PUBLIC_LOGIN_HIDDEN === "1"

  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || null

  const identityLoginUrl = process.env.NEXT_PUBLIC_IDENTITY_LOGIN_URL?.trim() || null

  const passwordLoginHidden =
    process.env.NEXT_PUBLIC_PASSWORD_LOGIN_HIDDEN === "1" && identityLoginUrl !== null

  if (loginHidden) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-8">
        <span className="text-2xl font-semibold tracking-widest">
          {appName ?? t("Open Base にログイン")}
        </span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-8">
      <div className="w-full max-w-md">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>
              {appName === null ? t("Open Base にログイン") : `${appName} にログイン`}
            </CardTitle>

            <CardDescription>
              {passwordLoginHidden
                ? t("組織のアカウントでログインしてください。")
                : t("アカウントのメールアドレスとパスワードを入力してください。")}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {passwordLoginHidden === false ? <LoginForm onAuthenticated={onAuthenticated} /> : null}

            {identityLoginUrl !== null ? (
              <Button nativeButton={false} render={<Link href="/auth/broker/login" />}>
                {t("組織のアカウントでログイン")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
