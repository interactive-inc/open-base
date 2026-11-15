import { Badge } from "@/components/ui/badge"
import type {
  AccountStatus,
  Identity,
  IdentityProvider,
  PrincipalKind,
} from "@/components/app/accounts-types"

/** サインインの方式の呼び名。 */
export const PROVIDER_TEXT: Readonly<Record<IdentityProvider, string>> = {
  password: "パスワード",
  passkey: "パスキー",
  google: "Google",
  github: "GitHub",
  oidc: "OIDC",
}

/** Principalの種類の呼び名。 */
export const PRINCIPAL_KIND_TEXT: Readonly<Record<PrincipalKind, string>> = {
  human: "人",
  agent: "エージェント",
  service: "サービス",
  connector: "外部接続",
}

type Label = { text: string; variant: "destructive" | "secondary" | "outline" }

const ACCOUNT_STATUS: Readonly<Record<AccountStatus, Label>> = {
  active: { text: "利用中", variant: "outline" },
  suspended: { text: "停止中", variant: "destructive" },
  locked: { text: "ロック中", variant: "destructive" },
}

/** Accountの状態を短い札で見せる。サインインできない状態は注意の色にする。 */
export function AccountStatusLabel({ status }: { status: AccountStatus }) {
  const item = ACCOUNT_STATUS[status]
  return <Badge variant={item.variant}>{item.text}</Badge>
}

const IDENTITY_STATE: Readonly<Record<Identity["state"], Label>> = {
  active: { text: "使用可", variant: "outline" },
  pending: { text: "登録待ち", variant: "secondary" },
  revoked: { text: "失効", variant: "outline" },
}

/** Identityの状態を短い札で見せる。パスキーは本人が登録するまで登録待ちになる。 */
export function IdentityStateLabel({ state }: { state: Identity["state"] }) {
  const item = IDENTITY_STATE[state]
  return <Badge variant={item.variant}>{item.text}</Badge>
}
