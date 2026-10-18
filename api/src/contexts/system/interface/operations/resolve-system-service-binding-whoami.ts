import { resolveSystemServiceBindingAccount } from "@system/interface/operations/resolve-system-service-binding-account"

/** Service Binding RPCの `whoami` が返す値。structured cloneで渡せる値だけを持つ。 */
export type SystemServiceBindingWhoamiResult =
  | Readonly<{ ok: true; account: Readonly<{ accountId: string }> }>
  | Readonly<{ ok: false; reason: "rejected" | "unavailable" }>

/**
 * 同じCloudflare accountのWorkerからService Binding RPCで渡されたaccess tokenの本人を返す。
 * 拒否理由は区別せず、Account状態の推測を防ぐ。
 */
export async function resolveSystemServiceBindingWhoami(
  context: Parameters<typeof resolveSystemServiceBindingAccount>[0],
  input: Readonly<{ accessToken: unknown; now: Date }>,
): Promise<SystemServiceBindingWhoamiResult> {
  const resolution = await resolveSystemServiceBindingAccount(context, input)
  if (resolution.kind !== "accepted") return { ok: false, reason: resolution.kind }

  return { ok: true, account: { accountId: resolution.accountId } }
}
