import type { ReactNode } from "react"

/** モックの画面の割り当て。自分の経路でなければnullを返す。 */
export type MockRoute = (input: {
  path: string
  query: URLSearchParams
  email: string
}) => ReactNode | null
