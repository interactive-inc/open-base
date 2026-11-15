import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "personnel-actions",
  summary: "人事発令の追記順の記録",
  defaultCommand: null,
  notes: "続きは応答の最後の sequence を --after-sequence に渡して読みます。",
  commands: {
    events: {
      summary: "確定した人事発令を追記順に読む",
      method: "GET",
      path: "/company/personnel-action-events",
      query: {
        "after-sequence": "after_sequence",
        "recorded-since": "recorded_since",
        limit: "limit",
      },
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
