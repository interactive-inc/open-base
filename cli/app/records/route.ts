import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "records",
  summary: "個人情報の消去・保全記録・案件の版",
  defaultCommand: null,
  notes: `erasure request のJSONは request_id、template_code、reason、target（kind: attachment か employee）です。鍵の破棄は承認の確定後にだけ行われます。
erasure execute は、最終承認者が消去の権限を持たず承認済みのまま残った消去案件を確定します。
preserved content は既存のファイルを上書きしません。format の package は --action export のときだけ使えます。`,
  commands: {
    "erasure request": {
      summary: "個人情報を含む添付の消去を申請",
      method: "POST",
      path: "/company/personal-data-erasure-requests",
      data: "required",
    },
    "erasure execute": {
      summary: "承認済みの消去案件を確定",
      method: "POST",
      path: "/company/personal-data-erasure-requests/:applicationId/execute",
    },
    "preserved list": {
      summary: "開示条件を満たす保全記録を探す",
      method: "GET",
      path: "/system/preserved-records",
      query: {
        action: "action",
        purpose: "purpose",
        "source-namespace": "source_namespace",
        "owner-context": "owner_context",
        "record-kind": "record_kind",
        "source-record-id": "source_record_id",
        cursor: "cursor",
        limit: "limit",
      },
      requiredQuery: ["action", "purpose"],
    },
    "preserved content": {
      summary: "保全原文をファイルへ保存",
      method: "GET",
      path: "/system/preserved-records/:recordId/content",
      query: { action: "action", purpose: "purpose", format: "format" },
      requiredQuery: ["action", "purpose"],
      download: true,
    },
    "preserved dossier": {
      summary: "原文・承認・保全・監査をまとめた記録",
      method: "GET",
      path: "/system/preserved-records/:recordId/dossier",
      query: { purpose: "purpose" },
      requiredQuery: ["purpose"],
    },
    "proposals show": {
      summary: "Systemの案件の版を一件参照",
      method: "GET",
      path: "/system/proposals/:number/versions/:version",
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
