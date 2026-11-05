import type { ReactNode } from "react"
import "@/components/globals.css"

/** 全画面に共通のstyleだけを読み込む。画面の枠は各画面が AuthFrame か AppShell で選ぶ。 */
export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
