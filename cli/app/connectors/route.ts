import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "connectors",
  summary: "外部接続の定義・交換・照合・配送と再実行",
  defaultCommand: null,
  notes: `JSONはAPIの形のまま指定します。交換・配送の冪等キーはJSONの idempotency_key で送ります。
create のJSONは id、key、name、direction、transport、update は name、status、expected_revision、reason です。
--step-up は base step-up で発行したトークンです。`,
  commands: {
    list: { summary: "Connectorの定義一覧", method: "GET", path: "/system/connectors" },
    create: {
      summary: "Connectorを定義（secretは含めない）",
      method: "POST",
      path: "/system/connectors",
      data: "required",
      stepUp: true,
    },
    update: {
      summary: "Connectorを停止・再開",
      method: "PATCH",
      path: "/system/connectors/:connectorId",
      data: "required",
      stepUp: true,
    },
    "exchanges list": {
      summary: "Connectorごとの外部交換の履歴",
      method: "GET",
      path: "/system/integration-exchanges",
      query: { "connector-id": "connector_id" },
      requiredQuery: ["connector-id"],
    },
    "exchanges create": {
      summary: "外部交換を開始",
      method: "POST",
      path: "/system/integration-exchanges",
      data: "required",
    },
    "exchanges show": {
      summary: "外部交換を一件参照",
      method: "GET",
      path: "/system/integration-exchanges/:exchangeId",
    },
    "exchanges update": {
      summary: "外部交換を成功・失敗・取消・再試行へ進める",
      method: "PATCH",
      path: "/system/integration-exchanges/:exchangeId",
      data: "required",
    },
    "reconciliations list": {
      summary: "外部交換の照合履歴",
      method: "GET",
      path: "/system/integration-exchanges/:exchangeId/reconciliations",
    },
    "reconciliations create": {
      summary: "照合の結果と差分を記録",
      method: "POST",
      path: "/system/integration-exchanges/:exchangeId/reconciliations",
      data: "required",
    },
    "dead-letters list": {
      summary: "dead letterと再実行状態",
      method: "GET",
      path: "/system/dead-letters",
    },
    "dead-letters requeue": {
      summary: "dead letterを一度だけ再投入（JSON: max_attempts、available_at、reason）",
      method: "POST",
      path: "/system/dead-letters/:deadLetterId/requeue",
      data: "required",
      stepUp: true,
    },
    "deliveries list": {
      summary: "jobとoutboxの状態（kind は job か outbox）",
      method: "GET",
      path: "/system/deliveries",
      query: { kind: "kind", status: "status" },
      requiredQuery: ["kind"],
    },
    "deliveries create": {
      summary: "job・outbox・inboxを冪等に登録",
      method: "POST",
      path: "/system/deliveries",
      data: "required",
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
