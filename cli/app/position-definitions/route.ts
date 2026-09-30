import { factory } from "@/factory"

export const help = `base position-definitions — 公開履歴の役職定義

usage:
  base position-definitions list --organization-id <id> [--as-of <YYYY-MM-DD>]
  base position-definitions create --data <confirmed-definition.json> --idempotency-key <key>
  base position-definitions update --data <confirmed-definition.json> --idempotency-key <key>
  base position-definitions delete --data <confirmed-definition.json> --idempotency-key <key>

listで会社版と資源版を確認し、保存時は同じ確認に基づくJSONを指定します。
取消も履歴へ記録し、過去の定義を物理削除しません。`

export default factory.createHandlers((context) => context.text(help))
