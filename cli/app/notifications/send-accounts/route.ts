import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "notifications",
  summary: "System Accountへの通知",
  defaultCommand: null,
  notes: `JSONには recipient_account_ids、kind（例: example:notice）、title を指定し、必要なら body、source、action、resource_scope、priority を加えます。
notification:send を持つ人だけが送れます。`,
  commands: {
    "send-accounts": {
      summary: "任意のactiveなAccountへ通知を配信",
      method: "POST",
      path: "/system/notifications",
      data: "required",
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
