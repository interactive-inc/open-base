import { Fragment, type ReactNode } from "react"
import { useRouter, useShared } from "@void/react"
import "@/client/page-setup"
import { AppShell, displayName } from "@/components/app/app-shell"
import type { Viewer } from "@/middleware/01.viewer"

/**
 * サインイン後の全画面の枠。サイドバーはここで一度だけ描き、画面を移っても作り直さない。
 * 本人の情報はmiddlewareが付けた共有データから読む。
 * 本文は、同じ画面の中でURLだけが変わる移動でも前の状態を残さないよう、URLごとに作り直す。
 * サインイン前後の手続きの画面は `_layouts/bare.tsx` を使う。
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { viewer } = useShared<{ viewer?: Viewer | null }>()
  const router = useRouter()

  // loaderがサインインへ送る途中など、本人がいない間は枠を描かない。
  // 共有データが届かなかったときも、画面を壊さず本文だけを出す。
  if (viewer === null || viewer === undefined) return <>{children}</>

  return (
    <AppShell
      email={viewer.email}
      name={displayName(viewer.profile, viewer.email)}
      pathname={router.path}
    >
      <Fragment key={router.url.href}>{children}</Fragment>
    </AppShell>
  )
}
