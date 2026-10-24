import type { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type SystemDeliveryTransitionInput =
  | Readonly<{ action: "claim"; lease_seconds: number }>
  | Readonly<{ action: "heartbeat"; lease_seconds: number }>
  | Readonly<{ action: "succeed" }>
  | Readonly<{ action: "fail"; error_code: string; retry_at: string }>
  | Readonly<{ action: "recover" }>

type Props = Readonly<{
  current: SystemDeliveryEntity
  input: SystemDeliveryTransitionInput
  accountId: AccountId
  leaseTokenHash: string | null
  now: Date
}>

export function transitionSystemDelivery(props: Props): SystemDeliveryEntity | Error {
  const { current, input, accountId, leaseTokenHash, now } = props
  if (input.action === "claim") {
    return leaseTokenHash === null
      ? new Error("lease token is unavailable")
      : current.claim(accountId, leaseTokenHash, now, input.lease_seconds * 1_000)
  }
  if (input.action === "heartbeat") {
    return leaseTokenHash === null
      ? new Error("lease token is unavailable")
      : current.heartbeat(accountId, leaseTokenHash, now, input.lease_seconds * 1_000)
  }
  if (input.action === "succeed") {
    return leaseTokenHash === null
      ? new Error("lease token is unavailable")
      : current.succeed(accountId, leaseTokenHash, now)
  }
  if (input.action === "fail") {
    return leaseTokenHash === null
      ? new Error("lease token is unavailable")
      : current.fail(accountId, leaseTokenHash, input.error_code, now, new Date(input.retry_at))
  }
  return current.recover(now)
}
