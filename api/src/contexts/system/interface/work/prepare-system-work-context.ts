import type { Context } from "hono"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { SystemWorkItemError } from "@system/domain/errors"
import { SystemWorkAuthorizationAdapter } from "@system/infrastructure/adapters/work/system-work-authorization.adapter"
import { SystemWorkItemRepository } from "@system/infrastructure/repositories/work/system-work-item.repository"

/** HTTPで検証したtokenから、操作と再認証を限定した作業contextを構成する。 */
export async function prepareSystemWorkContext(
  context: Context<SystemHonoEnv>,
  input: Readonly<{ permission: string; requiresStepUp: boolean }>,
) {
  const authentication = context.var.bearerReadAuthentication
  if (authentication === undefined) return new SystemWorkItemError("forbidden")
  const identities = new SystemWorkAuthorizationAdapter({
    env: { DB: context.env.DB },
    var: { now: context.var.now },
    authentication,
  })
  const authorization = await identities.prepare({
    permission: input.permission,
    stepUpToken: input.requiresStepUp ? (context.req.header("x-system-step-up") ?? "") : null,
  })
  if (authorization instanceof Error) return authorization
  return {
    authorization,
    identities,
    now: context.var.now,
    repository: new SystemWorkItemRepository({ env: { DB: context.env.DB }, authorization }),
  }
}
