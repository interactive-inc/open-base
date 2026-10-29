import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import {
  SystemInvalidSessionError,
  SystemNotificationUnavailableError,
} from "@system/interface/errors"

/** 受信者操作の認証を準備し、読取の最終照合と保存transactionへ同じproofを渡す。 */
export async function prepareSystemNotificationRecipientAccess(
  context: SystemD1Context & SystemClockContext & SystemAuthorizationContext,
) {
  const authentication = context.var.bearerReadAuthentication
  if (
    authentication === undefined ||
    authentication.accountId !== context.var.userId ||
    authentication.tokenVersion !== context.var.accountTokenVersion
  )
    throw new SystemInvalidSessionError()
  const proof = await new PrepareSystemReadAuthorizationAdapter(context).prepare(
    authentication,
    context.var.now(),
  )
  if (proof instanceof Error) throw new SystemNotificationUnavailableError()
  if (proof === null) throw new SystemInvalidSessionError()
  const repository = new SystemNotificationRepository({
    context,
    recipientAuthorization: {
      accountId: authentication.accountId,
      assertions: () => proof.assertions(context.var.now()),
    },
  })
  return {
    accountId: authentication.accountId,
    repository,
    revalidate: async () => {
      const checked = await repository.revalidateRecipient(authentication.accountId)
      if (checked instanceof Error) throw new SystemNotificationUnavailableError()
    },
  }
}
