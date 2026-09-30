"use client"

import { RefreshCw, ShieldAlert, WifiOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

/**
 * RSC でのサーバー取得失敗を表示する統一コンポーネント。
 * 各ページで `<p className="text-sm text-destructive">...の取得に失敗しました</p>` を書き散らさないようまとめる。
 * 一時的なエラーの可能性に備えて router.refresh() で再取得する導線を持つ。
 *
 * variant でエラー種別を分ける:
 * - "network" — サーバーに到達できなかった / タイムアウト
 * - "permission" — 権限不足（403 相当）
 * - "default" — その他のサーバーエラー
 */
type Props = {
  message: string
  variant?: "default" | "network" | "permission"
}

const variantConfig = {
  default: {
    icon: null,
    hint: null,
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    text: "text-destructive",
  },
  network: {
    icon: WifiOff,
    hint: "ネットワーク接続を確認して、もう一度お試しください。",
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    text: "text-orange-700 dark:text-orange-400",
  },
  permission: {
    icon: ShieldAlert,
    hint: "この操作に必要な権限がありません。管理者にお問い合わせください。",
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    text: "text-yellow-700 dark:text-yellow-400",
  },
} as const

export function FetchError(props: Props) {
  const router = useRouter()

  const variant = props.variant ?? "default"

  const config = variantConfig[variant]

  const Icon = config.icon

  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-2 rounded-2xl border ${config.border} ${config.bg} p-4`}
    >
      <div className="flex items-center gap-2">
        {Icon !== null ? <Icon className={`size-4 shrink-0 ${config.text}`} /> : null}

        <p className={`text-sm ${config.text}`}>{props.message}</p>
      </div>

      {config.hint !== null ? <p className="text-xs text-muted-foreground">{config.hint}</p> : null}

      {variant !== "permission" ? (
        <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
          <RefreshCw className="mr-2 size-4" />
          再読み込み
        </Button>
      ) : null}
    </div>
  )
}
