import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ResolveExternalAccessTokenAccountAdapter } from "@system/infrastructure/adapters/auth/resolve-external-access-token-account.adapter"
import { SystemAccessTokenStateAdapter } from "@system/infrastructure/adapters/auth/system-access-token-state.adapter"

/** Service Binding RPCの `whoami` が返す値。structured cloneで渡せる値だけを持つ。 */
export type SystemServiceBindingWhoamiResult =
  | Readonly<{ ok: true; account: Readonly<{ accountId: string }> }>
  | Readonly<{ ok: false; reason: "rejected" | "unavailable" }>

/** 署名済みaccess tokenとして扱う最大長。超える入力は検証せずに拒否する。 */
const MAX_ACCESS_TOKEN_LENGTH = 8_192

const rejected: SystemServiceBindingWhoamiResult = Object.freeze({ ok: false, reason: "rejected" })
const unavailable: SystemServiceBindingWhoamiResult = Object.freeze({
  ok: false,
  reason: "unavailable",
})

/**
 * 同じCloudflare accountのWorkerからService Binding RPCで渡されたaccess tokenの本人を返す。
 * HTTP APIのBearerとは受理するaudが異なり、委任・交換されたtokenは受理しない。
 * RPCの呼び出し元は型を守らない可能性があるため、文字列以外は拒否する。
 * 拒否理由は区別せず、Account状態の推測を防ぐ。
 */
export async function resolveSystemServiceBindingWhoami(
  context: Readonly<{
    env: ConstructorParameters<typeof ResolveExternalAccessTokenAccountAdapter>[0]["env"]
  }>,
  input: Readonly<{ accessToken: unknown; now: Date }>,
): Promise<SystemServiceBindingWhoamiResult> {
  if (!Number.isSafeInteger(input.now.getTime())) return unavailable
  if (
    typeof input.accessToken !== "string" ||
    input.accessToken.length === 0 ||
    input.accessToken.length > MAX_ACCESS_TOKEN_LENGTH
  ) {
    return rejected
  }

  const external = await new ResolveExternalAccessTokenAccountAdapter({
    env: context.env,
    purpose: "service_binding",
  }).resolve({ token: input.accessToken, now: input.now })
  if (external.kind === "unavailable") return unavailable
  if (external.kind !== "accepted") return rejected

  const accountId = zAccountId.safeParse(external.accountId)
  if (!accountId.success) return rejected

  // HTTP APIの外部access tokenと同じく、Accountの現在状態と人の主体であることを確かめる。
  const state = await new SystemAccessTokenStateAdapter({ database: context.env.DB }).resolve({
    accountId: accountId.data,
    tokenVersion: external.tokenVersion,
    issuedAtMs: 0,
    sessionFamilyId: null,
    at: input.now,
  })
  if (state instanceof Error) return unavailable
  if (state.kind === "rejected") return rejected

  return { ok: true, account: { accountId: accountId.data } }
}
