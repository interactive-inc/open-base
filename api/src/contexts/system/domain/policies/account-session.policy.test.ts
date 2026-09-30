import { describe, expect, test } from "bun:test"
import { getAccountSessionRejection } from "@system/domain/policies/account-session.policy"

describe("getAccountSessionRejection", () => {
  test("activeかつ同じ安全なtoken versionならSessionを許可する", () => {
    expect(
      getAccountSessionRejection({
        accountStatus: "active",
        accountTokenVersion: 0,
        sessionTokenVersion: 0,
      }),
    ).toBeNull()
    expect(
      getAccountSessionRejection({
        accountStatus: "active",
        accountTokenVersion: Number.MAX_SAFE_INTEGER,
        sessionTokenVersion: Number.MAX_SAFE_INTEGER,
      }),
    ).toBeNull()
  })

  test("suspendedまたはlocked Accountはtoken versionが一致しても拒否する", () => {
    expect(
      getAccountSessionRejection({
        accountStatus: "suspended",
        accountTokenVersion: 3,
        sessionTokenVersion: 3,
      }),
    ).toBe("account_inactive")
    expect(
      getAccountSessionRejection({
        accountStatus: "locked",
        accountTokenVersion: 3,
        sessionTokenVersion: 3,
      }),
    ).toBe("account_inactive")
  })

  test("Account側の不正なtoken versionを拒否する", () => {
    const invalidVersions = [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]

    for (const accountTokenVersion of invalidVersions) {
      expect(
        getAccountSessionRejection({
          accountStatus: "active",
          accountTokenVersion,
          sessionTokenVersion: 0,
        }),
      ).toBe("invalid_account_token_version")
    }
  })

  test("Session側の不正なtoken versionを拒否する", () => {
    const invalidVersions = [-1, 0.5, Number.NaN, Number.NEGATIVE_INFINITY, 2 ** 53]

    for (const sessionTokenVersion of invalidVersions) {
      expect(
        getAccountSessionRejection({
          accountStatus: "active",
          accountTokenVersion: 0,
          sessionTokenVersion,
        }),
      ).toBe("invalid_session_token_version")
    }
  })

  test("安全なtoken versionでも世代が違えば拒否する", () => {
    expect(
      getAccountSessionRejection({
        accountStatus: "active",
        accountTokenVersion: 2,
        sessionTokenVersion: 1,
      }),
    ).toBe("token_version_mismatch")
  })
})
