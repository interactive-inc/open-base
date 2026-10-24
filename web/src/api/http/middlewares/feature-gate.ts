import type { HonoEnv } from "@/env"
import { NotFoundError } from "@/lib/http/errors"
import { resolveDisabledRoutePrefixes } from "@/api/http/features/resolve-disabled-route-prefixes"
import { createMiddleware } from "hono/factory"

/**
 * 無効化されている機能のルートを 404 で遮断する。
 * 機能の存在自体を漏らさないため 403 ではなく 404 を返す。
 * 対応表は lib/feature/feature-route-registry.ts、切替は環境変数
 * ENABLED_OPT_IN_APPS / DISABLED_DEFAULT_APPS（.docs/feature-tiers.md が正本）。
 */
export const featureGate = createMiddleware<HonoEnv>(async (c, next) => {
  const disabledPrefixes = resolveDisabledRoutePrefixes({
    enabledOptInApps: c.env.ENABLED_OPT_IN_APPS,
    disabledDefaultApps: c.env.DISABLED_DEFAULT_APPS,
  })

  const path = c.req.path

  for (const prefix of disabledPrefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      throw new NotFoundError("not found")
    }
  }

  await next()
})
