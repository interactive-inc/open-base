"use client"

import { AuthContext } from "@/components/auth-context"
import type { MeResponse } from "@/lib/api/types/auth-types"

type Props = {
  currentUser: MeResponse
  children: React.ReactNode
}

/**
 * 認証済みユーザーをツリー下のコンポーネントへ Context 経由で配る Provider。
 * RSC で取得した `MeResponse` を AppShell の手前で注入する。
 */
export function AuthProvider(props: Props) {
  return <AuthContext.Provider value={props.currentUser}>{props.children}</AuthContext.Provider>
}
