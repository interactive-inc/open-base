import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "audit",
  summary: "Company・Systemの監査イベントと開示条件",
  defaultCommand: null,
  notes: `company export のJSONには from と to（必須）と、絞り込む actor_account_id、action、target_type、target_id、outcome を指定します。CSVを標準出力へ出します。
system list の続きのページは、最初の応答の boundary を --boundary に渡すと位置がずれません。
disclosure-policies publish のJSONは scope、commandId、expectedRevision、enabled、allowedFields、allowedTargetTypes、allowedPurposes、expiresAt、reason です。旧番号の設定を明示して引き継ぐ場合は、show で得た legacyPolicy の revision を supersedesLegacyRevision に指定します。省略すると旧設定の制限も残ります。`,
  commands: {
    "company list": {
      summary: "Companyの監査イベント",
      method: "GET",
      path: "/company/audit-events",
      query: {
        "actor-account-id": "actor_account_id",
        action: "action",
        "target-type": "target_type",
        "target-id": "target_id",
        outcome: "outcome",
        from: "from",
        to: "to",
        limit: "limit",
        cursor: "cursor",
      },
    },
    "company show": {
      summary: "Companyの監査イベントを一件参照",
      method: "GET",
      path: "/company/audit-events/:eventId",
    },
    "company export": {
      summary: "Companyの監査イベントをCSVで出力",
      method: "POST",
      path: "/company/audit-event-exports",
      data: "required",
    },
    "system list": {
      summary: "Systemの監査台帳",
      method: "GET",
      path: "/system/audit-events",
      query: {
        purpose: "purpose",
        action: "action",
        "actor-account-id": "actor_account_id",
        outcome: "outcome",
        "target-type": "target_type",
        "target-id": "target_id",
        "occurred-from": "occurred_from",
        "occurred-to": "occurred_to",
        limit: "limit",
        offset: "offset",
        boundary: "boundary",
      },
    },
    "system show": {
      summary: "Systemの監査イベントを開示条件に従って一件参照",
      method: "GET",
      path: "/system/audit-events/:eventId",
      query: { purpose: "purpose" },
    },
    "disclosure-policies show": {
      summary: "開示条件の最新版（scope は * かAccount ID）",
      method: "GET",
      path: "/system/audit-disclosure-policies",
      query: { scope: "scope" },
      requiredQuery: ["scope"],
    },
    "disclosure-policies publish": {
      summary: "開示条件を版つきで公開",
      method: "POST",
      path: "/system/audit-disclosure-policies",
      data: "required",
      stepUp: true,
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
