export type SystemScopedRoleBinding = Readonly<{
  id: string
  accountId: string
  roleId: string
  resourceId: string
  createdAt: Date
  permissionKeys: ReadonlyArray<string>
}>

export type SystemAccountDirectoryEntry = Readonly<{
  id: string
  status: "active" | "suspended" | "locked"
  updatedAt: Date
  hasLoginIdentity: boolean
  email: string | null
}>
