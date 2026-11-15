import { pageApiReader } from "@/api/http/void-api-route"
import * as accountDirectoryRoute from "@/api/routes/company.account-directory"
import * as permissionDefinitionsRoute from "@/api/routes/system.permission-definitions"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import * as accountRoute from "@system/interface/routes/system.accounts.$accountId"
import * as identitiesRoute from "@system/interface/routes/system.accounts.$accountId.identities"
import * as roleBindingsRoute from "@system/interface/routes/system.accounts.$accountId.role-bindings"
import * as accountsRoute from "@system/interface/routes/system.accounts"
import * as machineCredentialsRoute from "@system/interface/routes/system.principals.$principalId.machine-credentials"
import * as principalRoute from "@system/interface/routes/system.principals.$principalId"
import * as principalsRoute from "@system/interface/routes/system.principals"
import * as roleRoute from "@system/interface/routes/system.roles.$roleId"
import * as rolesRoute from "@system/interface/routes/system.roles"

/**
 * アカウントと権限の管理画面のloaderが最初の表示のために読むAPI。
 * 型は画面の側が決める。ここは経路とhandlerの対応だけを持つ。
 */
export const readAccounts = pageApiReader("/system/accounts", accountsRoute.GET)

export const readAccount = pageApiReader("/system/accounts/:accountId", accountRoute.GET)

export const readAccountIdentities = pageApiReader(
  "/system/accounts/:accountId/identities",
  identitiesRoute.GET,
)

export const readAccountRoleBindings = pageApiReader(
  "/system/accounts/:accountId/role-bindings",
  roleBindingsRoute.GET,
)

export const readAccountDirectory = pageApiReader(
  "/company/account-directory",
  accountDirectoryRoute.GET,
)

export const readRoles = pageApiReader("/system/roles", rolesRoute.GET)

export const readRole = pageApiReader("/system/roles/:roleId", roleRoute.GET)

export const readPermissionDefinitions = pageApiReader(
  "/system/permission-definitions",
  permissionDefinitionsRoute.GET,
)

export const readPrincipals = pageApiReader("/system/principals", principalsRoute.GET)

export const readPrincipal = pageApiReader("/system/principals/:principalId", principalRoute.GET)

export const readMachineCredentials = pageApiReader(
  "/system/principals/:principalId/machine-credentials",
  machineCredentialsRoute.GET,
)

/**
 * 会社の資源を扱うAPIへ渡す会社の識別子。
 * compositionは一つの会社だけを扱う（`app-base.ts` のcompany actorと同じ値）。
 */
export function readCompanyOrganizationId(): string {
  return COMPANY_DEFAULT_ORGANIZATION_ID
}
