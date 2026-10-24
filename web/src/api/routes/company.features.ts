import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppFeatureAvailability } from "@/api/http/company/response-schemas"
import { resolveDisabledFeatureKeys } from "@/api/http/features/resolve-disabled-feature-keys"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/**
 * GET /features — 機能ゲートの現在の状態（無効な機能キーの一覧）。
 * web がナビゲーションと画面の出し分けに使う。強制自体は各ルート前段の feature gate が担う。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const responseBody = zAppFeatureAvailability.parse({
    disabled_features: resolveDisabledFeatureKeys({
      enabledOptInApps: c.env.ENABLED_OPT_IN_APPS,
      disabledDefaultApps: c.env.DISABLED_DEFAULT_APPS,
    }),
  })

  return c.json(responseBody, 200)
})
