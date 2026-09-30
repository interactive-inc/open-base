import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { CompanyAccountProfileRenameGuardAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/company-account-profile-rename-guard.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("Companyの表示名所有者ガード", () => {
  test("同一transactionの先行変更を取り消し、紐付けを保全する", async () => {
    const database = await createLocalD1Database({
      schema: `
      CREATE TABLE company_account_employee_resource_bindings
        (resource_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, employee_id TEXT NOT NULL);
      INSERT INTO company_account_employee_resource_bindings
        VALUES ('link-1', 'account-1', 'employee-1');
      CREATE TABLE writes (value TEXT);
    `,
    })
    const query = new CompanyAccountProfileRenameGuardAdapter(drizzle(database))
      .build("account-1")
      .toSQL()
    const failure = await database
      .batch([
        database.prepare("INSERT INTO writes VALUES ('earlier effect')"),
        database.prepare(query.sql).bind(...query.params),
      ])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(CompanyAccountProfileRenameGuardAdapter.isBlocked(failure)).toBe(true)
    expect((await database.prepare("SELECT * FROM writes").all()).results).toEqual([])
    expect(
      (await database.prepare("SELECT * FROM company_account_employee_resource_bindings").all())
        .results,
    ).toEqual([{ resource_id: "link-1", account_id: "account-1", employee_id: "employee-1" }])
    expect(
      await new CompanyAccountProfileRenameGuardAdapter(drizzle(database))
        .build("unlinked-account")
        .get(),
    ).toEqual({ ok: 1 })
  })

  test("Companyの拒否を、接続障害・一般的なJSONエラー・別のガードと混同しない", () => {
    expect(
      CompanyAccountProfileRenameGuardAdapter.isBlocked(
        new Error(
          "D1_ERROR: bad JSON path: 'company_account_name_managed_by_employee': SQLITE_ERROR",
        ),
      ),
    ).toBe(true)
    expect(
      CompanyAccountProfileRenameGuardAdapter.isBlocked(
        new Error("query failed", {
          cause: new Error("JSON path error near 'company_account_name_managed_by_employee'"),
        }),
      ),
    ).toBe(true)
    expect(CompanyAccountProfileRenameGuardAdapter.isBlocked(new Error("malformed JSON"))).toBe(
      false,
    )
    expect(
      CompanyAccountProfileRenameGuardAdapter.isBlocked(
        new Error("Failed query: company_account_name_managed_by_employee", {
          cause: new Error("no such table: company_account_employee_resource_bindings"),
        }),
      ),
    ).toBe(false)
    const cyclic = new Error("connection failed")
    cyclic.cause = cyclic
    expect(CompanyAccountProfileRenameGuardAdapter.isBlocked(cyclic)).toBe(false)
  })
})
