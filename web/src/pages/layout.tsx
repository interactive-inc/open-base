import type { ReactNode } from "react"

/** 認証まわりの最小の画面枠。業務画面の移植時にデザインと置き換える。 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 420,
        margin: "15vh auto",
        padding: "0 16px",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.6,
      }}
    >
      {children}
    </main>
  )
}
