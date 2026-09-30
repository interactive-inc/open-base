import { relations } from "drizzle-orm"
import {
  systemAccounts,
  systemIamRolePermissions,
  systemIamRoles,
  systemIdentityBindings,
  systemIdentityProfiles,
  systemPasswordCredentials,
  systemRoleBindings,
} from "@system/infrastructure/schema/system-core"

export const systemAccountsRelations = relations(systemAccounts, (helpers) => ({
  identities: helpers.many(systemIdentityBindings),
  roleBindings: helpers.many(systemRoleBindings),
}))

export const systemIdentityBindingsRelations = relations(systemIdentityBindings, (helpers) => ({
  account: helpers.one(systemAccounts, {
    fields: [systemIdentityBindings.accountId],
    references: [systemAccounts.id],
  }),
  profile: helpers.one(systemIdentityProfiles, {
    fields: [systemIdentityBindings.id],
    references: [systemIdentityProfiles.identityId],
  }),
  passwordCredential: helpers.one(systemPasswordCredentials, {
    fields: [systemIdentityBindings.id],
    references: [systemPasswordCredentials.identityId],
  }),
}))

export const systemIamRolesRelations = relations(systemIamRoles, (helpers) => ({
  bindings: helpers.many(systemRoleBindings),
  rolePermissions: helpers.many(systemIamRolePermissions),
}))

export const systemIamRolePermissionsRelations = relations(systemIamRolePermissions, (helpers) => ({
  role: helpers.one(systemIamRoles, {
    fields: [systemIamRolePermissions.roleId],
    references: [systemIamRoles.id],
  }),
}))

export const systemRoleBindingsRelations = relations(systemRoleBindings, (helpers) => ({
  account: helpers.one(systemAccounts, {
    fields: [systemRoleBindings.accountId],
    references: [systemAccounts.id],
  }),
  role: helpers.one(systemIamRoles, {
    fields: [systemRoleBindings.roleId],
    references: [systemIamRoles.id],
  }),
}))
