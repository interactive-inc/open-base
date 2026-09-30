import { factory } from "@/factory"

export const help = `base notifications — 通知

usage:
  base notifications list [--unread]                              通知一覧
  base notifications count                                        未読件数
  base notifications read <id>                                    既読にする
  base notifications read-all                                     全件既読
  base notifications send --to <employee_code> --title <t> [--body <b>] [--kind <k>]   (管理者) 手動送信`

export default factory.createHandlers((c) => c.text(help))
