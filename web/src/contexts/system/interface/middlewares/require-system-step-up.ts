import { SystemStepUpGrantRepository } from "@system/infrastructure/repositories/iam/system-step-up-grant.repository"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  SystemPrincipalUnavailableError,
  SystemStepUpRequiredError,
} from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"

/** 高リスク操作の直前に、現在のAccountへ束縛した短命な再認証grantを検証する。 */
export const requireSystemStepUp = systemFactory.createMiddleware(async (context, next) => {
  const rawToken = context.req.header("x-system-step-up")
  if (rawToken === undefined || !/^[0-9a-f]{64}$/.test(rawToken)) {
    throw new SystemStepUpRequiredError()
  }
  const tokenHash = await new SystemPrincipalSecretService().hashRawSecret(rawToken)
  if (tokenHash instanceof Error) throw new SystemPrincipalUnavailableError(tokenHash)
  const accountId = zAccountId.safeParse(context.var.userId)
  if (!accountId.success) throw new SystemStepUpRequiredError()
  const accepted = await new SystemStepUpGrantRepository({ env: { DB: context.env.DB } }).use(
    accountId.data,
    tokenHash,
    context.var.now(),
  )
  if (accepted instanceof Error) throw new SystemPrincipalUnavailableError(accepted)
  if (!accepted) throw new SystemStepUpRequiredError()

  await next()
})
