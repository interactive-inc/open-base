import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "personnel-actions",
  summary: "人事変更の申請",
  defaultCommand: null,
  notes: "status は pending、approved、rejected、withdrawn のいずれかです。",
  commands: {
    requests: {
      summary: "人事変更の申請一覧",
      method: "GET",
      path: "/company/personnel-action-requests",
      query: { "target-employee-code": "target_employee_code", status: "status", limit: "limit" },
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
