import type { ReactNode } from "react"
import "@/client/page-setup"

/**
 * サイドバーを出さないレイアウト。サインイン、パスキーの登録、CLIの承認、CLIから開く判断の画面が使う。
 * 各画面が中央の枠（AuthFrame）を描く。
 */
export default function BareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
