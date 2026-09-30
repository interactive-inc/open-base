import { createClient } from "@/lib/api/hc-client"

/** System Account と active Role Binding の一覧を正規 System API から取得する。 */
export async function getAccounts() {
  const client = await createClient()

  const response = await client.system.accounts.$get()

  if (response.status !== 200) {
    return new Error("failed to load accounts")
  }

  const body = await response.json()
  const roleBindingResponses = await Promise.all(
    body.accounts.map((account) =>
      client.system.accounts[":accountId"]["role-bindings"].$get({
        param: { accountId: account.id },
      }),
    ),
  )
  if (roleBindingResponses.some((bindingResponse) => bindingResponse.status !== 200)) {
    return new Error("failed to load account role bindings")
  }
  const roleBindingBodies = await Promise.all(
    roleBindingResponses.map((bindingResponse) => bindingResponse.json()),
  )

  return body.accounts.map((account, index) => ({
    id: account.id,
    status: account.status,
    role_bindings:
      "role_bindings" in roleBindingBodies[index]
        ? roleBindingBodies[index].role_bindings.filter((binding) => binding.revoked_at === null)
        : [],
  }))
}
