import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { SystemForbiddenError } from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"

/** 発行元credentialが有効な機械access tokenを要求する。人のsessionは受け付けない。 */
export const authenticateSystemMachineAccessToken = systemFactory.createMiddleware(
  async (c, next) => {
    await authenticateSystemAccessToken(c, async () => {
      if (c.var.systemAccessToken?.machineCredentialId === undefined)
        throw new SystemForbiddenError()
      await next()
    })
  },
)
