import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { offsetPageQuery } from "@/lib/command/query-flags"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "application-requests",
  summary: "全社の申請",
  defaultCommand: null,
  notes:
    "application:read:all を持つ人だけが読めます。status は pending、approved、rejected のいずれかです。",
  commands: {
    admin: {
      summary: "全社の申請一覧",
      method: "GET",
      path: "/company/application-requests/admin",
      query: {
        status: "status",
        "applicant-id": "applicant_id",
        "template-code": "template_code",
        from: "from",
        to: "to",
        sort: "sort",
        ...offsetPageQuery,
      },
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
