import { factory } from "@/factory"

export const help = `base application-requests — 申請ワークフロー

usage:
  base application-requests templates [--category <c>]    申請テンプレート一覧
  base application-requests template <code>               申請テンプレート詳細
  base application-requests submit <code> --data <file>   申請を提出
  base application-requests inbox                         自分宛の承認待ち一覧
  base application-requests mine [--status <s>]           自分の申請一覧
  base application-requests show <id>                     申請の詳細
  base application-requests approve <id> [--comment <c>]  申請を承認
  base application-requests reject <id> --comment <c>     申請を却下
  base application-requests workflow-repair list          修復が必要な承認フロー一覧
  base application-requests workflow-repair reassign <id> --candidates <ids> --reason <text>
                                          承認候補を再割当`

export default factory.createHandlers((c) => c.text(help))
