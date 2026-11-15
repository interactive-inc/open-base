import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountStatusLabel } from "@/components/app/accounts-labels"
import type { AccountStatus, SystemAccount } from "@/components/app/accounts-types"

const STATUS_HELP: Readonly<Record<AccountStatus, string>> = {
  active: "サインインして使えます。",
  suspended: "停止中です。サインインできず、発行済みのセッションも使えません。",
  locked: "ロック中です。サインインできず、発行済みのセッションも使えません。",
}

/** Accountの状態と、その意味。状態の変更はCLIかMCPで行う。 */
export function AccountStatusPanel(props: { account: SystemAccount }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>状態</h2>
        </CardTitle>
        <div>
          <AccountStatusLabel status={props.account.status} />
        </div>
      </CardHeader>
      <CardContent>
        <p>{STATUS_HELP[props.account.status]}</p>
      </CardContent>
    </Card>
  )
}
