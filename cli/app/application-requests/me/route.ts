import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { offsetPageQuery } from "@/lib/command/query-flags"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "application-requests",
  summary: "本人が作成した申請",
  defaultCommand: null,
  notes: "取り下げた申請は含みません。状態で絞るときは base application-requests mine を使います。",
  commands: {
    me: {
      summary: "本人が作成した申請を新しい順に読む",
      method: "GET",
      path: "/company/application-requests/me",
      query: offsetPageQuery,
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
