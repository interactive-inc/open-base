import { HttpResponse } from "msw/http"
import type { Scenario } from "../types.ts"
import { defineMockArea } from "./area.ts"

type AccountStatus = "active" | "suspended" | "locked"
type Provider = "password" | "passkey" | "google" | "github" | "oidc"

type Account = {
  id: string
  status: AccountStatus
  token_version: number
  created_at: string
  updated_at: string
}
type Identity = {
  id: string
  account_id: string
  provider: Provider
  subject: string
  state: "active" | "pending" | "revoked"
  email: string | null
  email_verified: boolean
  last_used_at: string | null
  created_at: string
  activated_at: string | null
  revoked_at: string | null
}
type Role = {
  id: string
  key: string
  kind: "managed" | "custom"
  resource_type: string | null
  name: string
  description: string | null
  permission_keys: string[]
  created_at: string
  updated_at: string
}
type Binding = {
  id: string
  account_id: string
  role_id: string
  resource: { type: string; id: string } | null
  created_at: string
  revoked_at: string | null
}
type Principal = {
  id: string
  account_id: string
  kind: "human" | "agent" | "service" | "connector"
  name: string
  connector_id: string | null
  revision: number
  created_at: string
  updated_at: string
}
type Credential = {
  id: string
  principal_id: string
  name: string
  status: "active" | "revoked"
  created_at: string
  updated_at: string
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
}
type Employee = {
  id: string
  code: string
  name: string
  email: string
  status: "active" | "leave" | "retired"
  organization_unit_name: string | null
  position: string | null
}
type Link = {
  organizationId: string
  type: "account-employee-link"
  id: string
  revision: number
  state: "active" | "void"
  effectiveFrom: string
  effectiveTo: string | null
  attributes: { accountId: string; employeeId: string }
}

/** この領域の架空の状態。JSONへそのまま保存できる値だけを持つ。 */
export type State = {
  accounts: Account[]
  identities: Identity[]
  roles: Role[]
  bindings: Binding[]
  permissions: { key: string; description: string; category: string }[]
  principals: Principal[]
  credentials: Credential[]
  employees: Employee[]
  links: Link[]
  organizationRevision: number
  /** 直前のサインインが古く、再認証のgrantを受けられない状態。 */
  staleSignIn: boolean
  sequence: number
}

/** モックの画面と試験が使う、架空の会社の識別子。 */
const MOCK_ORGANIZATION_ID = "example-organization"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const at = (day: number, hour = 0) => new Date(Date.UTC(2026, 9, day, hour)).toISOString()
const NOW = new Date(Date.UTC(2026, 10, 14, 1)).toISOString()

/** 本人（モックでサインインしている管理者）のAccount。 */
const SELF = id(1)

function seed(scenario: Scenario): State {
  const base: State = {
    accounts: [],
    identities: [],
    roles: [],
    bindings: [],
    permissions: [],
    principals: [],
    credentials: [],
    employees: [],
    links: [],
    organizationRevision: 12,
    // 従業員と未連携のシナリオは、サインインから時間がたった管理者も兼ねて再現する。
    staleSignIn: scenario === "unlinked",
    sequence: 1000,
  }
  if (scenario === "empty") return base
  const account = (n: number, status: AccountStatus, day: number): Account => ({
    id: id(n),
    status,
    token_version: status === "active" ? 0 : 1,
    created_at: at(day),
    updated_at: at(day),
  })
  const identity = (
    n: number,
    accountId: string,
    provider: Provider,
    email: string | null,
    state: Identity["state"],
    day: number,
  ): Identity => ({
    id: id(n),
    account_id: accountId,
    provider,
    subject: provider === "passkey" ? accountId : (email ?? `example-subject-${n}`),
    state,
    email,
    email_verified: true,
    last_used_at: state === "active" ? at(day + 5, 9) : null,
    created_at: at(day),
    activated_at: state === "pending" ? null : at(day),
    revoked_at: state === "revoked" ? at(day + 3) : null,
  })
  const role = (
    n: number,
    key: string,
    kind: Role["kind"],
    name: string,
    permission_keys: string[],
    resource_type: string | null = null,
  ): Role => ({
    id: id(n),
    key,
    kind,
    resource_type,
    name,
    description: kind === "managed" ? "標準で用意されたロールです。" : null,
    permission_keys,
    created_at: at(1),
    updated_at: at(2),
  })
  const binding = (n: number, accountId: string, roleId: string): Binding => ({
    id: id(n),
    account_id: accountId,
    role_id: roleId,
    resource: null,
    created_at: at(3),
    revoked_at: null,
  })
  // 従業員の正本は従業員の領域のモックにある。IDと名前はそちらに合わせる。
  const employee = (code: string, name: string, unit: string): Employee => ({
    id: `employee-${code.toLowerCase()}`,
    code,
    name,
    email: `${code.toLowerCase()}@example.com`,
    status: "active",
    organization_unit_name: unit,
    position: null,
  })
  const link = (n: number, accountId: string, employeeId: string): Link => ({
    organizationId: MOCK_ORGANIZATION_ID,
    type: "account-employee-link",
    id: id(n),
    revision: 1,
    state: "active",
    effectiveFrom: "2026-10-01",
    effectiveTo: null,
    attributes: { accountId, employeeId },
  })
  return {
    ...base,
    accounts: [
      account(1, "active", 1),
      account(2, "active", 4),
      account(3, "suspended", 6),
      account(4, "active", 20),
      account(5, "active", 22),
    ],
    identities: [
      identity(101, id(1), "passkey", "you@example.com", "active", 1),
      identity(102, id(2), "passkey", "member@example.com", "active", 4),
      identity(103, id(2), "password", "member@example.com", "active", 4),
      identity(104, id(3), "password", "former@example.com", "active", 6),
      identity(105, id(4), "passkey", "new@example.com", "pending", 20),
    ],
    roles: [
      role(201, "system:admin", "managed", "システム管理者", [
        "iam:read",
        "iam:write",
        "system:admin",
      ]),
      role(202, "company:member", "managed", "従業員", ["application:read", "application:write"]),
      role(203, "example:reviewer", "custom", "評価の確認", ["review:read"]),
      role(
        204,
        "example:project-lead",
        "custom",
        "案件の担当",
        ["project:write"],
        "example:project",
      ),
    ],
    bindings: [
      binding(301, id(1), id(201)),
      binding(302, id(2), id(202)),
      binding(303, id(3), id(202)),
    ],
    permissions: [
      { key: "iam:read", description: "アカウントとロールを見る", category: "アカウントと権限" },
      { key: "iam:write", description: "アカウントとロールを変える", category: "アカウントと権限" },
      { key: "application:read", description: "申請を見る", category: "申請" },
      { key: "application:write", description: "申請を出す", category: "申請" },
      { key: "review:read", description: "評価を見る", category: "評価" },
      { key: "project:write", description: "案件を変える", category: "案件" },
    ],
    principals: [
      {
        id: id(401),
        account_id: id(1),
        kind: "human",
        name: "Example Administrator",
        connector_id: null,
        revision: 1,
        created_at: at(1),
        updated_at: at(1),
      },
      {
        id: id(402),
        account_id: id(5),
        kind: "agent",
        name: "Example Agent",
        connector_id: null,
        revision: 2,
        created_at: at(22),
        updated_at: at(23),
      },
    ],
    credentials: [
      {
        id: id(501),
        principal_id: id(402),
        name: "Example nightly job",
        status: "active",
        created_at: at(22),
        updated_at: at(22),
        expires_at: at(31, 14),
        last_used_at: at(25, 3),
        revoked_at: null,
      },
      {
        id: id(502),
        principal_id: id(402),
        name: "Example old job",
        status: "revoked",
        created_at: at(10),
        updated_at: at(21),
        expires_at: null,
        last_used_at: at(20),
        revoked_at: at(21),
      },
    ],
    employees: [
      employee("E0001", "Example Administrator", "管理部"),
      employee("E0003", "Example Engineer", "営業部"),
      employee("E0005", "Example Retiree", "営業部"),
      employee("E0008", "Example Member", "開発部"),
    ],
    links: [
      link(701, id(1), "employee-e0001"),
      link(702, id(2), "employee-e0008"),
      link(703, id(3), "employee-e0005"),
    ],
  }
}

const json = (body: Parameters<typeof HttpResponse.json>[0], status = 200) =>
  HttpResponse.json(body, { status })
const fail = (status: number, code: string) => json({ code, detail: code }, status)

function nextId(state: State) {
  state.sequence += 1
  return id(state.sequence)
}

/** Accountの応答。role_keysは有効なRole Bindingから組み立てる。 */
function accountView(state: State, account: Account) {
  const keys = state.bindings
    .filter((binding) => binding.account_id === account.id && binding.revoked_at === null)
    .flatMap((binding) => state.roles.find((role) => role.id === binding.role_id)?.key ?? [])
  return { ...account, role_keys: [...new Set(keys)].sort() }
}

function activeLink(state: State, accountId: string) {
  return state.links.find(
    (link) => link.state === "active" && link.attributes.accountId === accountId,
  )
}

/** Accountと在籍中の従業員を合成した一覧。結び付いていないAccountは含めない。 */
function directory(state: State) {
  return state.accounts
    .flatMap((account) => {
      const link = activeLink(state, account.id)
      const employee = state.employees.find((item) => item.id === link?.attributes.employeeId)
      return employee === undefined
        ? []
        : [
            {
              account_id: account.id,
              name: employee.name,
              email: employee.email,
              status: account.status,
            },
          ]
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

const STEP_UP_PATHS = [
  /^\/system\/accounts$/,
  /^\/system\/accounts\/[^/]+(\/identities(\/[^/]+)?|\/passkey-enrollments|\/password-credentials|\/role-bindings(\/[^/]+)?)?$/,
  /^\/system\/roles(\/[^/]+)?$/,
  /^\/system\/principals(\/[^/]+(\/machine-credentials(\/[^/]+)?)?)?$/,
]

export const area = defineMockArea<State>({
  name: "accounts",
  seed,
  handle: ({ state, root, path, method, body }) => {
    const owned =
      path === "/system/step-up-grants" ||
      path === "/system/permission-definitions" ||
      path === "/company/account-directory" ||
      path === "/company/account-employee-links" ||
      STEP_UP_PATHS.some((pattern) => pattern.test(path))
    if (!owned) return null

    if (path === "/system/step-up-grants" && method === "POST") {
      if (state.staleSignIn) return fail(401, "invalid_credentials")
      return json({ step_up_token: "0".repeat(64), method: "passkey", expires_at: NOW }, 201)
    }
    // 権限の無い利用者は、管理の経路をどれも読めない。
    if (root.scenario === "member") return fail(403, "forbidden")
    // モックはヘッダーを見られないので、再認証が古い状態では書き込みをすべて断る。
    if (method !== "GET" && state.staleSignIn && path.startsWith("/system/"))
      return fail(403, "step_up_required")

    if (path === "/system/permission-definitions" && method === "GET")
      return json({ data: state.permissions, total: state.permissions.length })
    if (path === "/company/account-directory" && method === "GET") {
      const data = directory(state)
      return json({ data, total: data.length })
    }
    if (path === "/company/account-employee-links") return handleLinks(state, method, body)
    if (path.startsWith("/system/accounts")) return handleAccounts(state, path, method, body)
    if (path.startsWith("/system/roles")) return handleRoles(state, path, method, body)
    if (path.startsWith("/system/principals")) return handlePrincipals(state, path, method, body)
    return fail(405, "method_not_allowed")
  },
})

function handleLinks(state: State, method: string, body: Record<string, unknown>) {
  if (method === "GET")
    return json({
      organizationId: MOCK_ORGANIZATION_ID,
      organizationRevision: state.organizationRevision,
      resources: state.links,
    })
  if (method !== "POST") return fail(405, "method_not_allowed")
  const resource = Array.isArray(body.resources)
    ? (body.resources[0] as Link | undefined)
    : undefined
  if (typeof body.reason !== "string" || body.reason.trim() === "" || resource === undefined)
    return fail(400, "invalid_company_body")
  if (resource.state === "active" && resource.revision === 1) {
    const taken = state.links.some(
      (link) =>
        link.state === "active" &&
        (link.attributes.accountId === resource.attributes.accountId ||
          link.attributes.employeeId === resource.attributes.employeeId),
    )
    if (taken) return fail(409, "company_resource_conflict")
    state.links.push({ ...resource, organizationId: MOCK_ORGANIZATION_ID })
  } else {
    const current = state.links.find((link) => link.id === resource.id)
    if (current === undefined || current.revision + 1 !== resource.revision)
      return fail(409, "company_resource_conflict")
    Object.assign(current, resource)
  }
  state.organizationRevision += 1
  return json(
    {
      organizationId: MOCK_ORGANIZATION_ID,
      organizationRevision: state.organizationRevision,
      replayed: false,
    },
    201,
  )
}

function handleAccounts(state: State, path: string, method: string, body: Record<string, unknown>) {
  if (path === "/system/accounts") {
    if (method === "GET") {
      const accounts = state.accounts.map((account) => accountView(state, account))
      return json({ accounts, total: accounts.length })
    }
    if (method !== "POST") return fail(405, "method_not_allowed")
    const account: Account = {
      id: nextId(state),
      status: "active",
      token_version: 0,
      created_at: NOW,
      updated_at: NOW,
    }
    state.accounts.push(account)
    return json(accountView(state, account), 201)
  }
  const [, , , accountId = "", child, childId] = path.split("/")
  const account = state.accounts.find((item) => item.id === accountId)
  if (account === undefined) return fail(404, "account_not_found")

  if (child === undefined) {
    if (method === "GET") return json(accountView(state, account))
    if (method !== "PATCH") return fail(405, "method_not_allowed")
    const status = body.status
    if (status !== "active" && status !== "suspended" && status !== "locked")
      return fail(400, "invalid_request")
    if (account.id === SELF && status !== "active") return fail(403, "forbidden")
    if (account.status !== status) {
      account.status = status
      account.token_version += 1
      account.updated_at = NOW
    }
    return json(accountView(state, account))
  }

  if (child === "identities") {
    if (childId === undefined) {
      if (method === "GET") {
        const identities = state.identities.filter((item) => item.account_id === account.id)
        return json({ identities, total: identities.length })
      }
      if (method !== "POST") return fail(405, "method_not_allowed")
      return createIdentity(state, account, body)
    }
    const identity = state.identities.find(
      (item) => item.id === childId && item.account_id === account.id,
    )
    if (identity === undefined) return fail(404, "identity_not_found")
    if (method === "GET") return json(identity)
    if (method !== "DELETE") return fail(405, "method_not_allowed")
    if (identity.state !== "active") return fail(404, "identity_not_found")
    const others = state.identities.filter(
      (item) =>
        item.account_id === account.id && item.state === "active" && item.id !== identity.id,
    )
    if (others.length === 0) return fail(409, "last_active_identity")
    identity.state = "revoked"
    identity.revoked_at = NOW
    return new HttpResponse(null, { status: 204 })
  }

  if (child === "passkey-enrollments" && method === "POST") {
    const identity = state.identities.find(
      (item) =>
        item.account_id === account.id && item.provider === "passkey" && item.state !== "revoked",
    )
    if (identity === undefined) return fail(404, "account_not_found")
    return json(
      {
        account_id: account.id,
        identity_id: identity.id,
        token: `example-enrollment-${state.sequence}`,
        expires_at: at(31),
      },
      201,
    )
  }

  if (child === "password-credentials" && method === "PATCH") {
    if (typeof body.password !== "string" || body.password.length < 12)
      return fail(400, "invalid_password")
    const has = state.identities.some(
      (item) =>
        item.account_id === account.id && item.provider === "password" && item.state === "active",
    )
    return has
      ? new HttpResponse(null, { status: 204 })
      : fail(404, "password_credential_not_found")
  }

  if (child === "role-bindings") {
    if (childId === undefined) {
      if (method === "GET") {
        const role_bindings = state.bindings.filter((item) => item.account_id === account.id)
        return json({ role_bindings, total: role_bindings.length })
      }
      if (method !== "POST") return fail(405, "method_not_allowed")
      if (account.id === SELF) return fail(403, "self_assignment")
      const role = state.roles.find((item) => item.id === body.role_id)
      if (role === undefined) return fail(404, "role_not_found")
      const resource = body.resource as Binding["resource"]
      if ((role.resource_type === null) !== (resource === null || resource === undefined))
        return fail(400, "invalid_role_binding")
      const duplicate = state.bindings.some(
        (item) =>
          item.account_id === account.id && item.role_id === role.id && item.revoked_at === null,
      )
      if (duplicate) return fail(409, "role_binding_conflict")
      const created: Binding = {
        id: nextId(state),
        account_id: account.id,
        role_id: role.id,
        resource: resource ?? null,
        created_at: NOW,
        revoked_at: null,
      }
      state.bindings.push(created)
      return json(created, 201)
    }
    const binding = state.bindings.find(
      (item) => item.id === childId && item.account_id === account.id && item.revoked_at === null,
    )
    if (binding === undefined || method !== "DELETE") return fail(404, "role_binding_not_found")
    binding.revoked_at = NOW
    return new HttpResponse(null, { status: 204 })
  }
  return fail(405, "method_not_allowed")
}

function createIdentity(state: State, account: Account, body: Record<string, unknown>) {
  const provider = body.provider as Provider
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null
  if (!["password", "passkey", "google", "github", "oidc"].includes(provider))
    return fail(400, "invalid_request")
  if (provider === "password" && (typeof body.password !== "string" || body.password.length < 12))
    return fail(400, "invalid_password")
  const subject =
    provider === "passkey"
      ? account.id
      : provider === "password"
        ? email
        : typeof body.subject === "string"
          ? body.subject
          : ""
  if (subject === null || subject === "") return fail(400, "invalid_request")
  if (
    state.identities.some(
      (item) => item.provider === provider && item.subject === subject && item.state !== "revoked",
    )
  )
    return fail(409, "identity_conflict")
  const identity: Identity = {
    id: nextId(state),
    account_id: account.id,
    provider,
    subject,
    state: provider === "passkey" ? "pending" : "active",
    email,
    email_verified:
      provider === "passkey" || provider === "password" || body.email_verified === true,
    last_used_at: null,
    created_at: NOW,
    activated_at: provider === "passkey" ? null : NOW,
    revoked_at: null,
  }
  state.identities.push(identity)
  return json(
    provider === "passkey"
      ? {
          ...identity,
          passkey_enrollment: { token: `example-enrollment-${state.sequence}`, expires_at: at(31) },
        }
      : identity,
    201,
  )
}

function handleRoles(state: State, path: string, method: string, body: Record<string, unknown>) {
  if (path === "/system/roles") {
    if (method === "GET") return json({ roles: state.roles, total: state.roles.length })
    if (method !== "POST") return fail(405, "method_not_allowed")
    if (typeof body.key !== "string" || typeof body.name !== "string" || body.name === "")
      return fail(400, "invalid_role")
    if (state.roles.some((role) => role.key === body.key)) return fail(409, "role_conflict")
    const role: Role = {
      id: nextId(state),
      key: body.key,
      kind: "custom",
      resource_type: typeof body.resource_type === "string" ? body.resource_type : null,
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
      permission_keys: Array.isArray(body.permission_keys)
        ? [...(body.permission_keys as string[])].sort()
        : [],
      created_at: NOW,
      updated_at: NOW,
    }
    state.roles.push(role)
    return json(role, 201)
  }
  const role = state.roles.find((item) => item.id === path.split("/")[3])
  if (role === undefined) return fail(404, "role_not_found")
  if (method === "GET") return json(role)
  if (role.kind === "managed") return fail(409, "managed_role")
  if (method === "PATCH") {
    if (typeof body.name !== "string" || body.name === "") return fail(400, "invalid_role")
    role.name = body.name
    role.description = typeof body.description === "string" ? body.description : null
    role.permission_keys = Array.isArray(body.permission_keys)
      ? [...(body.permission_keys as string[])].sort()
      : []
    role.updated_at = NOW
    return json(role)
  }
  if (method === "DELETE") {
    if (state.bindings.some((item) => item.role_id === role.id && item.revoked_at === null))
      return fail(409, "role_in_use")
    state.roles = state.roles.filter((item) => item.id !== role.id)
    return new HttpResponse(null, { status: 204 })
  }
  return fail(405, "method_not_allowed")
}

function handlePrincipals(
  state: State,
  path: string,
  method: string,
  body: Record<string, unknown>,
) {
  if (path === "/system/principals") {
    if (method === "GET") return json({ principals: state.principals })
    if (method !== "POST") return fail(405, "method_not_allowed")
    const kind = body.kind
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if ((kind !== "agent" && kind !== "service" && kind !== "connector") || name === "")
      return fail(400, "invalid_principal")
    if (kind === "connector" && typeof body.connector_id !== "string")
      return fail(400, "invalid_principal")
    const account: Account = {
      id: nextId(state),
      status: "active",
      token_version: 0,
      created_at: NOW,
      updated_at: NOW,
    }
    state.accounts.push(account)
    const principal: Principal = {
      id: nextId(state),
      account_id: account.id,
      kind,
      name,
      connector_id: kind === "connector" ? String(body.connector_id) : null,
      revision: 1,
      created_at: NOW,
      updated_at: NOW,
    }
    state.principals.push(principal)
    return json({ principal }, 201)
  }
  const [, , , principalId = "", child, credentialId] = path.split("/")
  const principal = state.principals.find((item) => item.id === principalId)
  if (principal === undefined) return fail(404, "principal_not_found")
  if (child === undefined) {
    if (method === "GET") return json({ principal })
    if (method !== "PATCH") return fail(405, "method_not_allowed")
    if (body.expected_revision !== principal.revision) return fail(409, "principal_conflict")
    if (typeof body.name !== "string" || body.name.trim() === "" || typeof body.reason !== "string")
      return fail(400, "invalid_principal")
    principal.name = body.name.trim()
    principal.revision += 1
    principal.updated_at = NOW
    return json({ principal })
  }
  if (child !== "machine-credentials") return fail(404, "principal_not_found")
  if (credentialId === undefined) {
    if (method === "GET")
      return json({
        credentials: state.credentials.filter((item) => item.principal_id === principal.id),
      })
    if (method !== "POST") return fail(405, "method_not_allowed")
    if (principal.kind === "human") return fail(400, "invalid_principal")
    if (typeof body.name !== "string" || typeof body.reason !== "string")
      return fail(400, "invalid_principal")
    const credential: Credential = {
      id: nextId(state),
      principal_id: principal.id,
      name: body.name,
      status: "active",
      created_at: NOW,
      updated_at: NOW,
      expires_at:
        typeof body.expires_at === "string" ? new Date(body.expires_at).toISOString() : null,
      last_used_at: null,
      revoked_at: null,
    }
    state.credentials.push(credential)
    return json({ credential, secret: "0".repeat(64) }, 201)
  }
  const credential = state.credentials.find(
    (item) => item.id === credentialId && item.principal_id === principal.id,
  )
  if (credential === undefined || method !== "DELETE") return fail(404, "principal_not_found")
  if (typeof body.reason !== "string" || body.reason.trim() === "")
    return fail(400, "invalid_request")
  credential.status = "revoked"
  credential.revoked_at = NOW
  credential.updated_at = NOW
  return new HttpResponse(null, { status: 204 })
}
