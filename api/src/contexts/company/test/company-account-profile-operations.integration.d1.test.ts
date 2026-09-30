import { buildCompanyAccountProfileDisplayNameUpdate } from "@/contexts/company/interface/operations/build-company-account-profile-display-name-update"
import { buildCompanyAccountProfileUpsert } from "@/contexts/company/interface/operations/build-company-account-profile-upsert"
import { hasCompanyAccountEmployeeLink } from "@/contexts/company/interface/operations/has-company-account-employee-link"
import { prepareCompanyAccountProfileRename } from "@/contexts/company/interface/operations/prepare-company-account-profile-rename"
import { readCompanyAccountProfile } from "@/contexts/company/interface/operations/read-company-account-profile"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("Account の表示名を作成・改名・更新し、保存値と正本の表示名、従業員との紐付けを読む", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  const database = drizzle(f.database)
  const accountId = zAccountId.parse("65205368-2ec8-4da3-82ec-42a667b80eee")
  await f.database
    .prepare(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, 0, 0)`,
    )
    .bind(accountId)
    .run()

  // 名前が空なら email を表示名にする。
  await database.batch([
    buildCompanyAccountProfileUpsert(database, {
      accountId,
      name: "  ",
      email: "you@example.com",
      now: new Date(1_000),
    }),
  ])
  expect(await readCompanyAccountProfile({ database, accountId })).toEqual({
    name: null,
    storedDisplayName: "you@example.com",
    updatedAt: 1_000,
  })

  await f.database.batch([
    prepareCompanyAccountProfileRename(f.database, {
      accountId,
      name: "Renamed Person",
      now: new Date(2_000),
    }),
  ])
  expect(await readCompanyAccountProfile({ database, accountId })).toMatchObject({
    storedDisplayName: "Renamed Person",
    updatedAt: 2_000,
  })

  await database.batch([
    buildCompanyAccountProfileDisplayNameUpdate(database, {
      accountId,
      displayName: "Updated Person",
      updatedAt: new Date(3_000),
    }),
  ])
  expect(
    await readCompanyAccountProfile({
      database,
      accountId,
      projection: { now: new Date("2030-06-01T00:00:00.000Z"), timeZone: "Asia/Tokyo" },
    }),
  ).toEqual({ name: "Updated Person", storedDisplayName: "Updated Person", updatedAt: 3_000 })

  expect(
    await readCompanyAccountProfile({
      database,
      accountId: zAccountId.parse("5d9189de-afda-44ce-a48c-eefa47fb97c2"),
    }),
  ).toBeUndefined()
  expect(await hasCompanyAccountEmployeeLink({ database, accountId })).toBe(false)
  expect(
    await hasCompanyAccountEmployeeLink({
      database,
      accountId: zAccountId.parse(f.creator.accountId),
    }),
  ).toBe(true)
})
