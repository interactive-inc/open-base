import { createClient } from "@/lib/api/hc-client"

/** Workersの同時接続上限（6）を超えないよう、Role Bindingの取得を並列数で区切る。 */
const ROLE_BINDING_CONCURRENCY = 6

/** System Account と active Role Binding の一覧を正規 System API から取得する。 */
export async function getAccounts() {
  const client = await createClient()

  const response = await client.system.accounts.$get()

  if (response.status !== 200) {
    return new Error("failed to load accounts")
  }

  const body = await response.json()

  const loadRoleBindings = async (accountId: string) => {
    const bindingResponse = await client.system.accounts[":accountId"]["role-bindings"].$get({
      param: { accountId },
    })
    if (bindingResponse.status !== 200) {
      await bindingResponse.body?.cancel()
      return new Error("failed to load account role bindings")
    }
    const bindingBody = await bindingResponse.json()
    return "role_bindings" in bindingBody
      ? bindingBody.role_bindings.filter((binding) => binding.revoked_at === null)
      : []
  }

  const roleBindings: Array<Awaited<ReturnType<typeof loadRoleBindings>>> = []
  for (let start = 0; start < body.accounts.length; start += ROLE_BINDING_CONCURRENCY) {
    const chunk = body.accounts.slice(start, start + ROLE_BINDING_CONCURRENCY)
    const results = await Promise.all(chunk.map((account) => loadRoleBindings(account.id)))
    if (results.some((result) => result instanceof Error)) {
      return new Error("failed to load account role bindings")
    }
    roleBindings.push(...results)
  }

  return body.accounts.map((account, index) => {
    const bindings = roleBindings[index]
    return {
      id: account.id,
      status: account.status,
      role_bindings: bindings instanceof Error ? [] : bindings,
    }
  })
}
