import { AccountDirectoryReadAdapter } from "@/api/http/accounts/account-directory-read.adapter"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/lib/http/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { zAppAccountDirectoryList } from "@/api/http/company/response-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const querySchema = z.object({
  status: z.enum(["active", "suspended", "locked"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
})

// @authorization permission - iam:read を持つ管理者だけが Account と連絡先の対応を読める
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", querySchema),
  async (context) => {
    const session = context.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("iam:read")) throw new ForbiddenError()

    const query = context.req.valid("query")
    const status = query.status ?? null
    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })
    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })
    const repository = new AccountDirectoryReadAdapter(context)
    const page = await repository.list({ status, limit, offset })
    if (page instanceof Error) throw new InternalError("failed to list account directory")

    return context.json(
      zAppAccountDirectoryList.parse({ data: page.accounts, total: page.total }),
      200,
    )
  },
)
