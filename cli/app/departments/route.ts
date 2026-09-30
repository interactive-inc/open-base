import { factory } from "@/factory"

export const help = `base departments — 部署と組織図

usage:
  base departments adoption --organization-unit-id <id>       組織履歴の接続準備
  base departments adoption --data <file> --idempotency-key <uuid>  確認済み履歴を接続
  base departments list                                        部署一覧
  base departments show <dept_code>                            部署の詳細
  base departments tree                                        部署ツリー
  base departments members <dept_code>                         部署メンバー
  base departments create --code <c> --name <n> [--parent-code <p>]  部署作成（管理者）
  base departments update <code> [--name <n>] [--parent-code <p>]  部署更新（管理者）
  base departments delete <code>                               部署削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
