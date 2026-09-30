import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import { SystemDeliveryUnavailableError, SystemForbiddenError } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"

// @authorization permission batch:view - dead letterと再実行状態を読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (
    !authorizeSystemOperation(
      context.var.permissions,
      SystemFeaturePermission.BATCH_VIEW.key,
      context.var.now(),
    )
  ) {
    throw new SystemForbiddenError()
  }
  const deadLetters = await new SystemDeliveryRepository({
    env: { DB: context.env.DB },
  }).findDeadLetters()
  if (deadLetters instanceof Error) throw new SystemDeliveryUnavailableError(deadLetters)
  return context.json({ dead_letters: deadLetters }, 200)
})
