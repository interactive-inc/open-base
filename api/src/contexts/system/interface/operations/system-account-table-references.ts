import { systemAccountInvitations, systemAccounts } from "@system/infrastructure/schema/system-core"

/** 業務のdrizzle schemaが外部キーで参照してよいSystem Accountの列。参照整合性だけに使う。 */
export const systemAccountTableReferences = Object.freeze({
  accountId: () => systemAccounts.id,
  accountInvitationId: () => systemAccountInvitations.id,
})
