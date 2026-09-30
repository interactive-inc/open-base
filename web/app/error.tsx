"use client"

import * as Sentry from "@sentry/nextjs"
import Link from "next/link"
import { useEffect } from "react"
import { LoginPage } from "@/components/login-page"
import { Button } from "@/components/ui/button"
import { isAuthErrorDigest } from "@/lib/api/auth-error"

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * ルートセグメントのエラーバウンダリ。`AuthError` ならログインフォームに差し替え、
 * それ以外は汎用の回復導線を出す。
 * `(app)/layout.tsx` 配下（保護領域）で投げられた認証エラーもここまでバブルアップさせ、
 * AppShell（サイドバー）ごとアンマウントした状態で全画面のログイン画面にする。
 */
export default function RootError(props: Props) {
  const isAuthError = isAuthErrorDigest(props.error.digest)

  useEffect(() => {
    if (isAuthError === false) {
      Sentry.captureException(props.error)
    }
  }, [isAuthError, props.error])

  if (isAuthError) {
    return <LoginPage onAuthenticated={props.reset} />
  }

  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">問題が発生しました</h1>

        <p className="text-sm text-muted-foreground">
          処理中にエラーが発生しました。お手数ですが、もう一度お試しください。
        </p>

        {props.error.digest !== undefined ? (
          <p className="text-xs text-muted-foreground">エラーID: {props.error.digest}</p>
        ) : null}
      </div>

      <div className="flex gap-4">
        <Button onClick={props.reset}>再試行</Button>

        <Button variant="secondary" nativeButton={false} render={<Link href="/" />}>
          ホームへ戻る
        </Button>
      </div>
    </main>
  )
}
