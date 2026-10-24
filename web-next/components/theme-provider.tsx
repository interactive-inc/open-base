"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

type Props = {
  children: React.ReactNode
  // CSP の nonce。next-themes が描画前に挿入するテーマ適用 script に付けないと
  // script が CSP に弾かれ、hydration までライトのまま描画されて一瞬白くなる。
  nonce: string | null
}

export function ThemeProvider(props: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={props.nonce ?? undefined}
    >
      {props.children}
    </NextThemesProvider>
  )
}
