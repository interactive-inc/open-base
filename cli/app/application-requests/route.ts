import { factory } from "@/factory"

export const help = `base application-requests — 申請ワークフロー

usage:
  base application-requests templates [--category <c>]    申請テンプレート一覧
  base application-requests template <code>               申請テンプレート詳細
  base application-requests submit <code> --data <file>   申請を提出
  base application-requests inbox                         自分宛の承認待ち一覧
  base application-requests mine [--status <s>]           自分の申請一覧
  base application-requests me [--limit <n> --offset <n>] 自分が作成した申請
  base application-requests admin [--status <s> --applicant-id <id> --template-code <c> --from <d> --to <d> --sort <s> --limit <n> --offset <n>]
                                          全社の申請一覧
  base application-requests show <id>                     申請の詳細
  base application-requests decide <id>                   判断の画面のURLを表示
  base application-requests workflow-repair list          修復が必要な承認フロー一覧
  base application-requests workflow-repair reassign <id> --candidates <ids> --reason <text>
                                          承認候補を再割当

承認・却下・差し戻しはブラウザーの判断の画面で人が行います。CLIからは記録できません。`

export default factory.createHandlers((c) => c.text(help))
