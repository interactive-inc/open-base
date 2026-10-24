import { defineHandler, type InferProps } from "void"

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => {
  // 戻り先は同じoriginの経路だけにし、外部サイトへのリダイレクトに使わせない。
  const next = c.req.query("next") ?? "/"
  return { next: next.startsWith("/") && !next.startsWith("//") ? next : "/" }
})
