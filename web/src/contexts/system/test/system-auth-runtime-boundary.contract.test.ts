import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

describe("System authentication runtime boundary", () => {
  test("canonical Sessionと認証table以外の旧runtimeを公開しない", () => {
    expect(systemCoreSchema).toHaveProperty("systemSessions")
    expect(systemCoreSchema).toHaveProperty("systemPasswordResetChallenges")
    expect(systemCoreSchema).toHaveProperty("systemAuthenticationAttempts")
    expect(systemCoreSchema).toHaveProperty("systemOidcAuthorizationCodes")
    expect(systemCoreSchema).toHaveProperty("systemOidcAccessTokens")
  })

  test("System production sourceに旧JWT Sessionと旧table経路を再導入しない", () => {
    const contextDirectory = new URL("../", import.meta.url)
    const retiredRuntimePattern =
      /verifyLegacy|SessionTokenService|MobileSessionTokenService|AccountTokenCollectionValue|system-runtime|passwordResetTokens|loginAttempts|password_reset_tokens|login_attempts|userIdentities|\busers\b|\bauditLogs\b|bootstrapState|entityIdAliases|deletedRecords|\buser_identities\b|\busers\b|\baudit_logs\b|\bbootstrap_state\b|\bentity_id_aliases\b|\bdeleted_records\b/
    const violations = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })]
      .filter((path) => !path.endsWith(".test.ts") && !path.startsWith("test/"))
      .filter((path) =>
        retiredRuntimePattern.test(readFileSync(new URL(path, contextDirectory), "utf8")),
      )

    expect(violations).toEqual([])
  })
})
