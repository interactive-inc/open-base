import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { companySnapshotQuery, offsetPageQuery } from "@/lib/command/query-flags"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "accounts",
  summary: "System Account・Identity・Role Binding・従業員との対応",
  defaultCommand: "list",
  notes: `引数なしの base accounts は一覧を表示します（iam:read）。
--step-up は base step-up で発行したトークンです。パスワードは標準入力から渡します。
employee-links save のJSONには organizationId と expectedRevision と本文（reason、resources）を指定します。`,
  commands: {
    list: { summary: "Account一覧", method: "GET", path: "/system/accounts" },
    show: { summary: "Accountを一件参照", method: "GET", path: "/system/accounts/:accountId" },
    create: {
      summary: "System Accountだけを作成",
      method: "POST",
      path: "/system/accounts",
      stepUp: true,
    },
    update: {
      summary: "Accountの状態を変更（JSON: status）",
      method: "PATCH",
      path: "/system/accounts/:accountId",
      data: "required",
      stepUp: true,
    },
    "identities list": {
      summary: "AccountのIdentity一覧",
      method: "GET",
      path: "/system/accounts/:accountId/identities",
    },
    "identities show": {
      summary: "Identityを一件参照",
      method: "GET",
      path: "/system/accounts/:accountId/identities/:identityId",
    },
    "identities create": {
      summary: "Identityを追加（JSON: provider、email など。password は標準入力）",
      method: "POST",
      path: "/system/accounts/:accountId/identities",
      data: "required",
      secret: { flag: "password-stdin", field: "password", required: false },
      stepUp: true,
    },
    "identities delete": {
      summary: "Identityを外す",
      method: "DELETE",
      path: "/system/accounts/:accountId/identities/:identityId",
      stepUp: true,
    },
    "passkey-enrollments create": {
      summary: "パスキー登録の招待を発行し直す",
      method: "POST",
      path: "/system/accounts/:accountId/passkey-enrollments",
      stepUp: true,
    },
    "password set": {
      summary: "パスワードを設定し直す（標準入力）",
      method: "PATCH",
      path: "/system/accounts/:accountId/password-credentials",
      secret: { flag: "password-stdin", field: "password", required: true },
      stepUp: true,
    },
    "role-bindings list": {
      summary: "Role Bindingの履歴",
      method: "GET",
      path: "/system/accounts/:accountId/role-bindings",
    },
    "role-bindings create": {
      summary: "Roleを付与（JSON: role_id、resource）",
      method: "POST",
      path: "/system/accounts/:accountId/role-bindings",
      data: "required",
      stepUp: true,
    },
    "role-bindings delete": {
      summary: "Role Bindingを外す",
      method: "DELETE",
      path: "/system/accounts/:accountId/role-bindings/:bindingId",
      stepUp: true,
    },
    directory: {
      summary: "Accountと連絡先の対応（iam:read）",
      method: "GET",
      path: "/company/account-directory",
      query: { status: "status", ...offsetPageQuery },
    },
    "employee-links list": {
      summary: "Accountと従業員の対応の公開履歴",
      method: "GET",
      path: "/company/account-employee-links",
      organization: "flag",
      query: companySnapshotQuery,
    },
    "employee-links save": {
      summary: "Accountと従業員の対応を記録",
      method: "POST",
      path: "/company/account-employee-links",
      data: "required",
      organization: "data",
      idempotencyKey: true,
    },
  },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
