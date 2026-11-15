import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "attachments",
  summary: "添付の預け入れ・取り出し・保全",
  defaultCommand: null,
  notes: `base attachments upload --file <path> で預け、表示された id を業務の操作に渡します（pdf、jpg、jpeg、png、heic）。
show は紐づけ前の本人の添付だけを取り出し、既存のファイルは上書きしません。
preservations create のJSONは id、sha256、kind（hold、retention）、retainUntil、reason、release は operationId、expectedRevision、reason です。`,
  commands: {
    show: {
      summary: "紐づけ前の添付をファイルへ保存",
      method: "GET",
      path: "/system/attachments/:attachmentId",
      download: true,
    },
    "purge-unlinked": {
      summary: "紐づかないまま期限を過ぎた添付を削除（system:admin）",
      method: "POST",
      path: "/system/attachments/purge-unlinked",
    },
    "preservations list": {
      summary: "保全と解除の記録",
      method: "GET",
      path: "/system/attachments/:attachmentId/preservations",
      query: { cursor: "cursor", limit: "limit" },
    },
    "preservations create": {
      summary: "内容を固定して添付を保全",
      method: "POST",
      path: "/system/attachments/:attachmentId/preservations",
      data: "required",
      stepUp: true,
    },
    "preservations release": {
      summary: "保全を解除",
      method: "POST",
      path: "/system/attachments/:attachmentId/preservations/:preservationId/release",
      data: "required",
      stepUp: true,
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
