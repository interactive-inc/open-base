import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "roles",
  summary: "System Roleと権限の定義",
  defaultCommand: "list",
  notes: `引数なしの base roles は一覧を表示します（iam:read）。
create・update のJSONは key、name、description、permission_keys などAPIの形のまま指定します。
--step-up は base step-up で発行したトークンです。`,
  commands: {
    list: { summary: "Role一覧", method: "GET", path: "/system/roles" },
    show: { summary: "Roleを権限つきで一件参照", method: "GET", path: "/system/roles/:roleId" },
    create: {
      summary: "Roleを作成",
      method: "POST",
      path: "/system/roles",
      data: "required",
      stepUp: true,
    },
    update: {
      summary: "Roleの名前・説明・権限を変更",
      method: "PATCH",
      path: "/system/roles/:roleId",
      data: "required",
      stepUp: true,
    },
    delete: {
      summary: "使われていないRoleを削除",
      method: "DELETE",
      path: "/system/roles/:roleId",
      stepUp: true,
    },
    "permission-definitions": {
      summary: "有効な機能の権限カタログ（iam:write）",
      method: "GET",
      path: "/system/permission-definitions",
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
