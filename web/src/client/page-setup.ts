/// <reference types="vite/client" />
import "@/components/globals.css"
import { applyThemeChoice, readThemeChoice } from "@/client/theme"

/**
 * 全画面に共通の準備。styleを読み込み、保存してある配色の選び方を反映し、開発のときだけ画面とエージェントの橋渡しを読み込む。
 * 橋渡しの分岐はproduction buildでは丸ごと消える。
 */
if (typeof window !== "undefined") applyThemeChoice(readThemeChoice())

if (import.meta.env.DEV && typeof window !== "undefined") {
  void import("@/client/dev-agent")
}

export {}
