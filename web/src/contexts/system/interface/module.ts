import { inspectSystemAccountDeletion } from "@system/interface/capabilities/accounts/inspect-account-deletion"
import { prepareSystemAccountDeletionStatements } from "@system/interface/capabilities/accounts/prepare-account-deletion"

/** API rootへ公開するSystem contextの境界。実装の合成はAPI rootだけが行う。 */
export const systemContextModule = {
  context: "system",
  tier: "system",
  routesDirectory: "contexts/system/interface/routes",
  routeImportPrefix: "@system/interface/routes",
  capabilities: {
    accountDeletion: {
      inspect: inspectSystemAccountDeletion,
      prepareStatements: prepareSystemAccountDeletionStatements,
    },
  },
} as const
