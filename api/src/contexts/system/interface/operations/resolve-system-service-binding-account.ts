import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  ResolveBearerAccountAdapter,
  type VerifiedExternalAccessTokenAccount,
} from "@system/infrastructure/adapters/auth/resolve-bearer-account.adapter"
import { ResolveExternalAccessTokenAccountAdapter } from "@system/infrastructure/adapters/auth/resolve-external-access-token-account.adapter"

export type SystemServiceBindingAccountResolution =
  | Readonly<{
      kind: "accepted"
      accountId: AccountId
      /** HTTP appへ渡す検証済みの主体。呼び出し元のWorkerへは返さない。 */
      account: VerifiedExternalAccessTokenAccount
    }>
  | Readonly<{ kind: "rejected" }>
  | Readonly<{ kind: "unavailable" }>

/** 署名済みaccess tokenとして扱う最大長。超える入力は検証せずに拒否する。 */
const MAX_ACCESS_TOKEN_LENGTH = 8_192

/**
 * Service Binding RPCで渡されたaccess tokenを、RPC入口専用のaudで検証してSystem Accountへ解決する。
 * HTTP APIのBearerとは受理するaudが異なり、委任・交換されたtokenは受理しない。
 * Accountの現在状態はHTTPの外部access tokenと同じ照合を通す。
 * RPCの呼び出し元は型を守らない可能性があるため、文字列以外は拒否する。拒否理由は返さない。
 */
export async function resolveSystemServiceBindingAccount(
  context: Readonly<{
    env: ConstructorParameters<typeof ResolveBearerAccountAdapter>[0]["env"]
  }>,
  input: Readonly<{ accessToken: unknown; now: Date }>,
): Promise<SystemServiceBindingAccountResolution> {
  if (!Number.isSafeInteger(input.now.getTime())) return { kind: "unavailable" }
  if (
    typeof input.accessToken !== "string" ||
    input.accessToken.length === 0 ||
    input.accessToken.length > MAX_ACCESS_TOKEN_LENGTH
  ) {
    return { kind: "rejected" }
  }

  const external = await new ResolveExternalAccessTokenAccountAdapter({
    env: context.env,
    purpose: "service_binding",
  }).resolve({ token: input.accessToken, now: input.now })
  if (external.kind === "unavailable") return { kind: "unavailable" }
  if (external.kind !== "accepted") return { kind: "rejected" }

  const authentication = await new ResolveBearerAccountAdapter({
    env: context.env,
  }).resolveVerifiedExternal({ external, now: input.now })
  if (authentication.kind === "unavailable") return { kind: "unavailable" }
  if (authentication.kind === "rejected") return { kind: "rejected" }

  return { kind: "accepted", accountId: authentication.accountId, account: external }
}
