import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

describe("System authentication runtime boundary", () => {
  test("人のログインはBetter Authに任せ、パスワードとSystem独自のセッションのtableを持たない", () => {
    expect(systemCoreSchema).toHaveProperty("systemPasskeyEnrollments")
    expect(systemCoreSchema).toHaveProperty("systemAuthenticationAttempts")
    for (const retired of [
      "systemSessions",
      "systemPasswordCredentials",
      "systemPasswordResetChallenges",
      "systemCliLoginCodes",
      "systemCliLoginStates",
      "systemBrowserLoginCodes",
      "systemIdentityLoginTokens",
      "systemOidcAuthorizationCodes",
      "systemOidcAccessTokens",
    ]) {
      expect(systemCoreSchema).not.toHaveProperty(retired)
    }
  })

  test("System production sourceに旧Sessionとパスワードの経路を再導入しない", () => {
    const contextDirectory = new URL("../", import.meta.url)
    const retiredRuntimePattern =
      /system_sessions|system_password_credentials|hashPassword|verifyPassword|verifyLegacy|SessionTokenService|MobileSessionTokenService|AccountTokenCollectionValue|system-runtime|passwordResetTokens|loginAttempts|password_reset_tokens|login_attempts|userIdentities|\busers\b|\bauditLogs\b|bootstrapState|entityIdAliases|deletedRecords|\buser_identities\b|\busers\b|\baudit_logs\b|\bbootstrap_state\b|\bentity_id_aliases\b|\bdeleted_records\b/
    const violations = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })]
      .filter((path) => !path.endsWith(".test.ts") && !path.startsWith("test/"))
      .filter((path) =>
        retiredRuntimePattern.test(readFileSync(new URL(path, contextDirectory), "utf8")),
      )

    expect(violations).toEqual([])
  })
})
