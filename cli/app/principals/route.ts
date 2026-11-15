import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "principals",
  summary: "Agent・Service・ConnectorのPrincipalと機械credential",
  defaultCommand: null,
  notes: `create のJSONは kind（agent、service、connector）と name、connector は connector_id も指定します。
update のJSONは name、expected_revision、reason です。
machine-credentials create は発行したsecretを一度だけ表示します。安全な保管先へ移してください。
--step-up は base step-up で発行したトークンです。`,
  commands: {
    list: { summary: "Principal一覧", method: "GET", path: "/system/principals" },
    show: {
      summary: "Principalを一件参照",
      method: "GET",
      path: "/system/principals/:principalId",
    },
    create: {
      summary: "Principalと専用Accountを作成",
      method: "POST",
      path: "/system/principals",
      data: "required",
      stepUp: true,
    },
    update: {
      summary: "Principalの名前を変更",
      method: "PATCH",
      path: "/system/principals/:principalId",
      data: "required",
      stepUp: true,
    },
    "machine-credentials list": {
      summary: "機械credentialの一覧（secretは含まない）",
      method: "GET",
      path: "/system/principals/:principalId/machine-credentials",
    },
    "machine-credentials create": {
      summary: "機械credentialを発行（JSON: name、expires_at、reason）",
      method: "POST",
      path: "/system/principals/:principalId/machine-credentials",
      data: "required",
      stepUp: true,
    },
    "machine-credentials delete": {
      summary: "機械credentialを失効（JSON: reason）",
      method: "DELETE",
      path: "/system/principals/:principalId/machine-credentials/:credentialId",
      data: "required",
      stepUp: true,
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
