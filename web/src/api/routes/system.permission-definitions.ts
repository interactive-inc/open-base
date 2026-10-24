import { toEnabledPermissionEntries } from "@/api/http/permissions/to-enabled-permission-entries"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { zAppPermissionList } from "@/api/http/system/response-schemas"

// @authorization permission - 権限キーで判定する
/**
 * GET /permission-definitions — 有効な機能の権限カタログ（iam:write が必要）。
 * ロール編集 UI の checkbox とカテゴリ表示に使う。正はコードの PERMISSION_CATALOG。
 * 無効化された App の権限は選択肢に出さないため、機能ゲートと同じ判定で除く。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (
    session.hasPermission("system:admin") === false &&
    session.hasPermission("iam:write") === false
  ) {
    throw new ForbiddenError("cannot manage roles")
  }

  const enabledEntries = toEnabledPermissionEntries({
    enabledOptInApps: c.env.ENABLED_OPT_IN_APPS,
    disabledDefaultApps: c.env.DISABLED_DEFAULT_APPS,
  })

  const responseBody = zAppPermissionList.parse({
    data: enabledEntries.map((entry) => ({
      key: entry.key,
      description: entry.description,
      category: entry.category,
    })),
    total: enabledEntries.length,
  })

  return c.json(responseBody, 200)
})
