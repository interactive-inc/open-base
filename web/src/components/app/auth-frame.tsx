import { CircleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  title: string
  description?: ReactNode
  error?: string
  children?: ReactNode
  footer?: ReactNode
  /** 判断の画面のように読む量が多いときは "wide" にする。 */
  width?: "narrow" | "wide"
}

/**
 * サインイン、パスキー登録、CLIの承認、判断など、サイドバーの無い手続きを中央のカードで見せる。
 * ページの地の上にカードを一枚だけ置く。
 */
export function AuthFrame(props: Props) {
  const error = props.error ?? ""
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-page p-4">
      <span className="text-base font-semibold tracking-wider">Base</span>
      <Card className={props.width === "wide" ? "w-full max-w-2xl" : "w-full max-w-sm"}>
        <CardHeader>
          <CardTitle>
            <h1>{props.title}</h1>
          </CardTitle>
          {props.description !== undefined && (
            <CardDescription>{props.description}</CardDescription>
          )}
        </CardHeader>
        {(props.children !== undefined || error !== "") && (
          <CardContent className="flex flex-col gap-4">
            {props.children}
            {error !== "" && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>
      {props.footer !== undefined && <p className="max-w-sm text-center text-xs">{props.footer}</p>}
    </div>
  )
}
