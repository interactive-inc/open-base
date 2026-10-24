import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { AccountEntity } from "@system/domain/entities/account.entity"
import { describe, expect, test } from "bun:test"

const accountId = zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")

function repository(
  account: Awaited<ReturnType<SystemAccountRepository["find"]>>,
): Pick<SystemAccountRepository, "find"> {
  return { find: async () => account }
}

function account(status: "active" | "suspended" | "locked", tokenVersion: number) {
  return AccountEntity.create({
    id: accountId,
    status,
    tokenVersion,
    createdAt: new Date(100),
    updatedAt: new Date(200),
  })
}

describe("resolveAccountSession", () => {
  test("active AccountEntityと同じtoken versionのSessionを許可する", async () => {
    const resolved = await SystemAccountRepository.resolveSession({
      accountRepository: repository(account("active", 3)),
      accountId,
      sessionTokenVersion: 3,
    })

    expect(resolved).toMatchObject({ kind: "accepted", account: { id: accountId } })
  })

  test.each([
    ["suspended", 3, 3, "account_inactive"],
    ["locked", 3, 3, "account_inactive"],
    ["active", 4, 3, "token_version_mismatch"],
  ] as const)(
    "canonical AccountEntityがSessionを拒否する理由を維持する",
    async (status, accountTokenVersion, sessionTokenVersion, reason) => {
      const resolved = await SystemAccountRepository.resolveSession({
        accountRepository: repository(account(status, accountTokenVersion)),
        accountId,
        sessionTokenVersion,
      })

      expect(resolved).toEqual({ kind: "rejected", reason })
    },
  )

  test("canonical AccountEntityが存在しなければ拒否する", async () => {
    const resolved = await SystemAccountRepository.resolveSession({
      accountRepository: repository(null),
      accountId,
      sessionTokenVersion: 0,
    })

    expect(resolved).toEqual({ kind: "rejected", reason: "account_not_found" })
  })

  test("repository Errorを認証拒否へ畳まず呼出元へ返す", async () => {
    const readError = new Error("database unavailable")
    const resolved = await SystemAccountRepository.resolveSession({
      accountRepository: repository(readError),
      accountId,
      sessionTokenVersion: 0,
    })

    expect(resolved).toBe(readError)
  })
})
