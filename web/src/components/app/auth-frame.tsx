import type { ReactNode } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  title: string
  description?: ReactNode
  error?: string
  children?: ReactNode
  footer?: ReactNode
}

/** サインイン、パスキー登録、CLIの承認など、サインイン前後の手続きを中央のカードで見せる枠。 */
export function AuthFrame(props: Props) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-content p-4">
      <span className="text-base font-semibold tracking-wider">Base</span>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1>{props.title}</h1>
            </CardTitle>
            {props.description !== undefined && (
              <CardDescription>{props.description}</CardDescription>
            )}
          </CardHeader>
          {(props.children !== undefined || (props.error ?? "") !== "") && (
            <CardContent className="flex flex-col gap-4">
              {props.children}
              {(props.error ?? "") !== "" && (
                <Alert variant="destructive">
                  <AlertDescription>{props.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          )}
        </Card>
      </div>
      {props.footer !== undefined && (
        <p className="max-w-sm text-center text-xs text-muted-foreground">{props.footer}</p>
      )}
    </div>
  )
}
