import { testAccountId } from "@/contexts/system/test/system-test-id.test-support"
import { IamGraphPolicy } from "@system/domain/policies/iam-graph.policy"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { InvalidIamGraphError } from "@system/domain/errors"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import { describe, expect, test } from "bun:test"

const NOW = new Date("2026-08-11T00:00:00.000Z")
/** role と割当の主キーは UUID のため、テストで読みやすい名前を決まった UUID へ対応させる。 */
const namedIds = new Map<string, string>()

function idOf(name: string): string {
  const known = namedIds.get(name)
  if (known !== undefined) return known
  const id = `00000000-0000-4000-8000-${(namedIds.size + 1).toString(16).padStart(12, "0")}`
  namedIds.set(name, id)
  return id
}

function requireRole(name: string, permissionKeys: ReadonlyArray<string>): IamRoleEntity {
  const role = IamRoleEntity.create({
    id: idOf(`role:${name}`),
    key: `system:${name}`,
    kind: "managed",
    name,
    permissionKeys,
    createdAt: NOW,
    updatedAt: NOW,
  })
  if (role instanceof Error) throw role
  return role
}

function requireBinding(
  name: string,
  accountId: string,
  roleId: string,
  resource: Readonly<{ type: string; id: string }> | null = null,
): RoleBindingEntity {
  const binding = RoleBindingEntity.create({
    id: idOf(`binding:${name}`),
    accountId,
    roleId,
    resource,
    createdAt: NOW,
    revokedAt: null,
  })
  if (binding instanceof Error) throw binding
  return binding
}

function requireGraph(
  roles: ReadonlyArray<IamRoleEntity>,
  bindings: ReadonlyArray<RoleBindingEntity>,
): IamGraphPolicy {
  const graph = IamGraphPolicy.create(roles, bindings)
  expect(graph).toBeInstanceOf(IamGraphPolicy)
  if (graph instanceof Error) throw graph
  return graph
}

describe("IamGraphPolicy permission evaluation", () => {
  test("global bindingと完全一致resource bindingをliveに評価する", () => {
    const reader = requireRole("reader", ["example:read"])
    const global = requireBinding("global", "d5858208-e680-4db8-a05d-8bf4f900c24e", reader.id)
    const scoped = requireBinding("scoped", "4b0518fd-9017-4afc-addd-bb50998b0273", reader.id, {
      type: "example:resource",
      id: "facility-1",
    })
    const graph = requireGraph([reader], [global, scoped])

    expect(
      graph.getPermissionDecision({
        accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
        permissionKey: "example:read",
        resource: { type: "example:resource", id: "facility-2" },
        at: NOW,
      }),
    ).toBe("allowed")
    expect(
      graph.getPermissionDecision({
        accountId: "4b0518fd-9017-4afc-addd-bb50998b0273",
        permissionKey: "example:read",
        resource: { type: "example:resource", id: "facility-1" },
        at: NOW,
      }),
    ).toBe("allowed")
    expect(
      graph.getPermissionDecision({
        accountId: "4b0518fd-9017-4afc-addd-bb50998b0273",
        permissionKey: "example:read",
        resource: { type: "example:resource", id: "facility-2" },
        at: NOW,
      }),
    ).toBe("denied")
  })

  test("global system:adminだけが全permissionを短絡する", () => {
    const root = requireRole("root", ["system:admin"])
    const global = requireBinding(
      "f16b950f-c6db-4760-8994-95cc8065169d",
      "d5858208-e680-4db8-a05d-8bf4f900c24e",
      root.id,
    )
    const scoped = requireBinding("scoped-root", "4b0518fd-9017-4afc-addd-bb50998b0273", root.id, {
      type: "example:resource",
      id: "facility-1",
    })
    const graph = requireGraph([root], [global, scoped])

    expect(
      graph.getPermissionDecision({
        accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
        permissionKey: "future:operate",
        resource: { type: "future:resource", id: "resource-1" },
        at: NOW,
      }),
    ).toBe("allowed")
    expect(
      graph.getPermissionDecision({
        accountId: "4b0518fd-9017-4afc-addd-bb50998b0273",
        permissionKey: "future:operate",
        resource: { type: "example:resource", id: "facility-1" },
        at: NOW,
      }),
    ).toBe("denied")
    expect(
      graph.getPermissionDecision({
        accountId: "4b0518fd-9017-4afc-addd-bb50998b0273",
        permissionKey: "system:admin",
        resource: { type: "example:resource", id: "facility-1" },
        at: NOW,
      }),
    ).toBe("denied")
  })

  test("未知入力と不正clockをinvalidとしてdenyする", () => {
    const graph = requireGraph([], [])

    for (const props of [
      { accountId: "", permissionKey: "iam:read", resource: null, at: NOW },
      {
        accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
        permissionKey: "invalid",
        resource: null,
        at: NOW,
      },
      {
        accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
        permissionKey: "iam:read",
        resource: {},
        at: NOW,
      },
      {
        accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
        permissionKey: "iam:read",
        resource: null,
        at: new Date(Number.NaN),
      },
      {
        accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
        permissionKey: "iam:read",
        resource: null,
        at: "now",
      },
    ]) {
      expect(graph.getPermissionDecision(props)).toBe("invalid")
    }
  })
})

describe("IamGraphPolicy integrity and last-root", () => {
  test.each(["duplicate_role_id", "duplicate_binding_id", "unknown_binding_role"] as const)(
    "破損graphをfail closedで拒否する: %s",
    (reason) => {
      const role = requireRole("root", ["system:admin"])
      const binding = requireBinding(
        "ae18ee9b-62ff-4396-8971-165b0ac77248",
        "d5858208-e680-4db8-a05d-8bf4f900c24e",
        role.id,
      )
      const roles = reason === "duplicate_role_id" ? [role, role] : [role]
      const bindings =
        reason === "duplicate_binding_id"
          ? [binding, binding]
          : reason === "unknown_binding_role"
            ? [
                requireBinding(
                  "unknown",
                  "d5858208-e680-4db8-a05d-8bf4f900c24e",
                  idOf("role:missing"),
                ),
              ]
            : [binding]
      const graph = IamGraphPolicy.create(roles, bindings)

      expect(graph).toBeInstanceOf(InvalidIamGraphError)
      expect(graph instanceof InvalidIamGraphError ? graph.reason : null).toBe(reason)
    },
  )

  test("最後のactive global root bindingだけを削除拒否する", () => {
    const root = requireRole("root", ["system:admin"])
    const reader = requireRole("reader", ["iam:read"])
    const rootBinding = requireBinding("root-1", "d5858208-e680-4db8-a05d-8bf4f900c24e", root.id)
    const readerBinding = requireBinding(
      "reader-1",
      "d5858208-e680-4db8-a05d-8bf4f900c24e",
      reader.id,
    )
    const graph = requireGraph([reader, root], [readerBinding, rootBinding])
    const activeAccountIds = new Set(["d5858208-e680-4db8-a05d-8bf4f900c24e"])

    expect(
      graph.getBindingRevocationRejection({
        bindingId: rootBinding.id,
        activeAccountIds,
        at: NOW,
      }),
    ).toBe("last_root_binding")
    expect(
      graph.getBindingRevocationRejection({
        bindingId: readerBinding.id,
        activeAccountIds,
        at: NOW,
      }),
    ).toBeNull()
  })

  test("別のactive global rootが残れば削除でき、resource rootとinactive Accountは数えない", () => {
    const root = requireRole("root", ["system:admin"])
    const first = requireBinding("root-1", "d5858208-e680-4db8-a05d-8bf4f900c24e", root.id)
    const second = requireBinding("root-2", "4b0518fd-9017-4afc-addd-bb50998b0273", root.id)
    const scoped = requireBinding("root-scoped", testAccountId("account-3"), root.id, {
      type: "example:resource",
      id: "facility-1",
    })
    const graph = requireGraph([root], [first, second, scoped])

    expect(
      graph.getBindingRevocationRejection({
        bindingId: first.id,
        activeAccountIds: new Set([
          "d5858208-e680-4db8-a05d-8bf4f900c24e",
          "4b0518fd-9017-4afc-addd-bb50998b0273",
        ]),
        at: NOW,
      }),
    ).toBeNull()
    expect(
      graph.getBindingRevocationRejection({
        bindingId: first.id,
        activeAccountIds: new Set(["d5858208-e680-4db8-a05d-8bf4f900c24e"]),
        at: NOW,
      }),
    ).toBe("last_root_binding")
  })

  test("不正Account集合・binding ID・clockをinvalidとして拒否する", () => {
    const graph = requireGraph([], [])

    expect(
      graph.getBindingRevocationRejection({
        bindingId: "",
        activeAccountIds: new Set(),
        at: NOW,
      }),
    ).toBe("invalid_evaluation_input")
    expect(
      graph.getBindingRevocationRejection({
        bindingId: "ae18ee9b-62ff-4396-8971-165b0ac77248",
        activeAccountIds: new Set([""]),
        at: NOW,
      }),
    ).toBe("invalid_evaluation_input")
    expect(
      graph.getBindingRevocationRejection({
        bindingId: "ae18ee9b-62ff-4396-8971-165b0ac77248",
        activeAccountIds: new Set(),
        at: new Date(Number.NaN),
      }),
    ).toBe("invalid_evaluation_input")
  })
})
