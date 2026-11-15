/**
 * アカウントと権限の管理画面が読むAPIの応答の形。
 * 正本は `web/src/contexts/system/interface/routes/system.*.ts` と `web/src/api/routes/*.ts` の応答。
 */

export type AccountStatus = "active" | "suspended" | "locked"

export type SystemAccount = {
  id: string
  status: AccountStatus
  token_version: number
  role_keys: ReadonlyArray<string>
  created_at: string
  updated_at: string
}

export type SystemAccountList = { accounts: ReadonlyArray<SystemAccount>; total: number }

export type IdentityProvider = "password" | "passkey" | "google" | "github" | "oidc"

export type Identity = {
  id: string
  account_id: string
  provider: IdentityProvider
  subject: string
  state: "active" | "pending" | "revoked"
  email: string | null
  email_verified: boolean
  last_used_at: string | null
  created_at: string
  activated_at: string | null
  revoked_at: string | null
}

export type IdentityList = { identities: ReadonlyArray<Identity>; total: number }

export type RoleBinding = {
  id: string
  account_id: string
  role_id: string
  resource: { type: string; id: string } | null
  created_at: string
  revoked_at: string | null
}

export type RoleBindingList = { role_bindings: ReadonlyArray<RoleBinding>; total: number }

export type Role = {
  id: string
  key: string
  kind: "managed" | "custom"
  resource_type: string | null
  name: string
  description: string | null
  permission_keys: ReadonlyArray<string>
  created_at: string
  updated_at: string
}

export type RoleList = { roles: ReadonlyArray<Role>; total: number }

export type PermissionDefinition = { key: string; description: string; category: string }

export type PermissionDefinitionList = { data: ReadonlyArray<PermissionDefinition>; total: number }

/** Accountと、結び付いた在籍中の従業員の名前と連絡先。結び付いていないAccountは含まない。 */
export type AccountDirectoryEntry = {
  account_id: string
  name: string
  email: string | null
  status: AccountStatus
}

export type AccountDirectory = { data: ReadonlyArray<AccountDirectoryEntry>; total: number }

export type PrincipalKind = "human" | "agent" | "service" | "connector"

export type Principal = {
  id: string
  account_id: string
  kind: PrincipalKind
  name: string
  connector_id: string | null
  revision: number
  created_at: string
  updated_at: string
}

export type PrincipalList = { principals: ReadonlyArray<Principal> }

export type MachineCredential = {
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

export type MachineCredentialList = { credentials: ReadonlyArray<MachineCredential> }

/** 会社の資源としての、Accountと従業員の結び付け。 */
export type AccountEmployeeLink = {
  organizationId: string
  type: "account-employee-link"
  id: string
  revision: number
  state: "active" | "void"
  effectiveFrom: string
  effectiveTo: string | null
  attributes: { accountId: string; employeeId: string }
}

export type AccountEmployeeLinkList = {
  organizationId: string
  organizationRevision: number
  resources: ReadonlyArray<AccountEmployeeLink>
}
