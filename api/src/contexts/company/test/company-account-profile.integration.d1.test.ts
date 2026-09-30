import { UpdateCompanyAccountProfile } from "@/contexts/company/application/account-profile/update-company-account-profile"
import { D1CompanyAccountProfileRepository } from "@/contexts/company/infrastructure/repositories/account-profile/d1-company-account-profile.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { CompanyAccountNameManagedByEmployeeError } from "@/contexts/company/domain/errors"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schemaSql = `
  CREATE TABLE system_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    token_version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE company_organizations (
    id TEXT PRIMARY KEY NOT NULL,
    revision INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE company_account_profiles (
    organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (organization_id, account_id)
  );
  CREATE TABLE company_account_employee_resource_bindings (
    organization_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    employee_id TEXT NOT NULL
  );
  INSERT INTO company_organizations (id, revision, created_at, updated_at)
    VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 0, 0, 0);
`

describe("Company Account Profile", () => {
  test("読み取り後の従業員紐付けを保存時に再検査する", async () => {
    const database = await createLocalD1Database({
      schema: `${schemaSql}
      INSERT INTO system_accounts VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 7, 100, 100);
      INSERT INTO company_account_profiles VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'Employee name', 100, 100);
    `,
    })
    const repository = new D1CompanyAccountProfileRepository(database)
    const commit = database.batch.bind(database)
    database.batch = async (statements) => {
      await database
        .prepare(
          `INSERT INTO company_account_employee_resource_bindings VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'link-1', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'employee-1')`,
        )
        .run()
      return commit(statements)
    }
    const result = await new UpdateCompanyAccountProfile(repository).execute(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      "d5858208-e680-4db8-a05d-8bf4f900c24e",
      "Stale rename",
      new Date(200),
    )
    expect(result).toBeInstanceOf(CompanyAccountNameManagedByEmployeeError)
    expect(
      await database
        .prepare("SELECT display_name, updated_at FROM company_account_profiles")
        .first<{ display_name: string; updated_at: number }>(),
    ).toEqual({ display_name: "Employee name", updated_at: 100 })
  })

  test("紐付いたAccountでも同じ表示名は履歴時刻を変えずに返す", async () => {
    const database = await createLocalD1Database({
      schema: `${schemaSql}
      INSERT INTO system_accounts VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 7, 100, 100);
      INSERT INTO company_account_profiles VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'Employee name', 100, 100);
      INSERT INTO company_account_employee_resource_bindings VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'link-1', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'employee-1');
    `,
    })
    const result = await new UpdateCompanyAccountProfile(
      new D1CompanyAccountProfileRepository(database),
    ).execute(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      "d5858208-e680-4db8-a05d-8bf4f900c24e",
      "Employee name",
      new Date(200),
    )
    expect(result).not.toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT display_name, updated_at FROM company_account_profiles")
        .first<{ display_name: string; updated_at: number }>(),
    ).toEqual({ display_name: "Employee name", updated_at: 100 })
  })

  test("reads and updates the Company-owned display name without changing System Account", async () => {
    const database = await createLocalD1Database({
      schema: `${schemaSql}
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 7, 100, 100);
      INSERT INTO company_account_profiles
        (organization_id, account_id, display_name, created_at, updated_at)
        VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'Before', 100, 100);
    `,
    })
    const repository = new D1CompanyAccountProfileRepository(database)

    const before = await repository.find({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
    })
    expect(before).not.toBeNull()
    expect(before).not.toBeInstanceOf(Error)
    if (before === null || before instanceof Error) return
    expect(before.displayName).toBe("Before")

    const updated = await new UpdateCompanyAccountProfile(repository).execute(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      "d5858208-e680-4db8-a05d-8bf4f900c24e",
      "After",
      new Date(200),
    )
    expect(updated).not.toBeNull()
    expect(updated).not.toBeInstanceOf(Error)
    if (updated === null || updated instanceof Error) return
    expect(updated.displayName).toBe("After")
    expect(
      await database
        .prepare(
          "SELECT status, token_version FROM system_accounts WHERE id = 'd5858208-e680-4db8-a05d-8bf4f900c24e'",
        )
        .first<{ status: string; token_version: number }>(),
    ).toEqual({ status: "active", token_version: 7 })
  })

  test("does not create a missing profile during update", async () => {
    const database = await createLocalD1Database({ schema: schemaSql })
    const repository = new D1CompanyAccountProfileRepository(database)

    expect(
      await new UpdateCompanyAccountProfile(repository).execute(
        COMPANY_DEFAULT_ORGANIZATION_ID,
        "missing",
        "Name",
        new Date(200),
      ),
    ).toBeNull()
  })
})
