"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
import "./globals.css"
import { Button } from "@/components/ui/button"

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * グローバルエラーバウンダリ。ルート layout 自体で投げられた例外を捕捉する
 * （app/error.tsx は layout 配下のみが対象で root layout の例外は拾えない）。
 * root layout を置き換えるため html/body を自前で描画する。
 */
export default function GlobalError(props: Props) {
  useEffect(() => {
    Sentry.captureException(props.error)
  }, [props.error])

  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">問題が発生しました</h1>

          <p className="text-sm text-muted-foreground">
            処理中にエラーが発生しました。お手数ですが、もう一度お試しください。
          </p>

          {props.error.digest !== undefined ? (
            <p className="text-xs text-muted-foreground">エラーID: {props.error.digest}</p>
          ) : null}
        </div>

        <Button onClick={props.reset}>再試行</Button>
      </body>
    </html>
  )
}
