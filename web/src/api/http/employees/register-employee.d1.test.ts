import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { RegisterEmployee } from "@/api/http/employees/register-employee"
import type { Context } from "@/bindings"
import { fingerprintPersonnelAction } from "@/contexts/company/domain/definitions/fingerprint-personnel-action.definition"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { hashPassword } from "@system/lib/auth/hash-password"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const ACTOR_ACCOUNT_ID = "6f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f"
const EMPLOYEE_ACCOUNT_ID = "d5858208-e680-4db8-a05d-8bf4f900c24e"
const IDEMPOTENCY_KEY = "0b7f1e2d-3c4b-4a59-8e6f-7a8b9c0d1e2f"
const PEPPER = "register-employee-test-pepper"
const ORIGINAL_PASSWORD = "original-password-0001"
const action: Extract<PersonnelActionInput, { kind: "hire" }> = {
  kind: "hire",
  employmentType: "FULL_TIME",
  employeeCode: "E900",
  employeeName: "Example Person",
  eventOn: restoreCalendarDate("2026-01-01"),
  departmentCode: null,
  positionTitle: null,
  managerEmployeeCode: null,
}

/** 完了済みの登録だけを置いた最小のSystem・Company表で、再送の照合を検査する。 */
async function createRegisteredContext() {
  const database = await createLocalD1Database({ schema: "" })
  const fingerprint = await fingerprintPersonnelAction("prospective:E900", action, 3)
  const hash = await hashPassword(ORIGINAL_PASSWORD, PEPPER)
  await execSql(
    database,
    `CREATE TABLE system_iam_roles (id TEXT PRIMARY KEY, key TEXT, kind TEXT, resource_type TEXT,
       name TEXT, description TEXT, created_at INTEGER, updated_at INTEGER);
     CREATE TABLE system_iam_role_permissions (role_id TEXT, permission_key TEXT);
     CREATE TABLE system_role_bindings (id TEXT PRIMARY KEY, account_id TEXT, role_id TEXT,
       resource_type TEXT, resource_id TEXT, created_at INTEGER, revoked_at INTEGER);
     CREATE TABLE system_identity_bindings (id TEXT PRIMARY KEY, account_id TEXT, provider TEXT,
       subject TEXT, created_at INTEGER, activated_at INTEGER, revoked_at INTEGER);
     CREATE TABLE system_identity_profiles (identity_id TEXT PRIMARY KEY, email TEXT);
     CREATE TABLE system_password_credentials (identity_id TEXT PRIMARY KEY, password_hash TEXT);
     CREATE TABLE company_personnel_actions (id TEXT PRIMARY KEY, employee_id TEXT, kind TEXT,
       payload_fingerprint TEXT, recorded_by_account_id TEXT, operation_id TEXT);
     CREATE TABLE company_resource_revisions (organization_id TEXT, resource_type TEXT,
       resource_id TEXT, revision INTEGER, command_id TEXT, attributes_json TEXT);
     CREATE TABLE company_account_employee_resource_bindings (employee_id TEXT, account_id TEXT);
     INSERT INTO system_iam_roles VALUES
       ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'company:member', 'managed', NULL, 'Member', NULL, 0, 0);
     INSERT INTO system_iam_role_permissions VALUES
       ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'employee:read');
     INSERT INTO system_role_bindings VALUES
       ('b63cf0e2-c63e-4834-8bc0-840f72f13aa4', '${EMPLOYEE_ACCOUNT_ID}',
        '1f178fc9-9b4d-4247-8dc8-8f1344bf445d', NULL, NULL, 0, NULL);
     INSERT INTO system_identity_bindings VALUES
       ('a5a88835-2a43-4022-bc5c-370a679ccb3c', '${EMPLOYEE_ACCOUNT_ID}', 'password',
        'you@example.com', 0, 0, NULL);
     INSERT INTO system_identity_profiles VALUES
       ('a5a88835-2a43-4022-bc5c-370a679ccb3c', 'you@example.com');
     INSERT INTO company_resource_revisions VALUES
       ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee', 'employee-1', 1, 'initial-workforce:action-1',
        '{"personId":"person:employee-1","employeeCode":"E900"}'),
       ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:employee-1', 1, 'initial-workforce:action-1',
        '{"officialName":"Example Person","email":"you@example.com","phone":null}');
     INSERT INTO company_account_employee_resource_bindings VALUES ('employee-1', '${EMPLOYEE_ACCOUNT_ID}');`,
  )
  await database
    .prepare("INSERT INTO system_password_credentials VALUES (?1, ?2)")
    .bind("a5a88835-2a43-4022-bc5c-370a679ccb3c", hash)
    .run()
  await database
    .prepare(
      "INSERT INTO company_personnel_actions VALUES ('action-1', 'employee-1', 'hire', ?1, ?2, ?3)",
    )
    .bind(fingerprint, ACTOR_ACCOUNT_ID, IDEMPOTENCY_KEY)
    .run()
  const session = { accountId: ACTOR_ACCOUNT_ID, employeeId: null, hasPermission: () => true }
  const context = {
    env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo", PEPPER_SECRET: PEPPER },
    var: { session, database: null, auditContext: null },
  } as unknown as Context
  const register = (password: string) =>
    new RegisterEmployee(context).execute({
      action,
      expectedCompanyRevision: 3,
      email: "you@example.com",
      password,
      roleKey: "member",
      idempotencyKey: IDEMPOTENCY_KEY,
      now: new Date("2026-01-02T00:00:00.000Z"),
    })
  return { database, register }
}

test("再送は送られたpasswordに関係なく同じ結果を返し、現在のpasswordを推測させない", async () => {
  const c = await createRegisteredContext()
  const original = await c.register(ORIGINAL_PASSWORD)
  const guessed = await c.register("different-password-0002")

  expect(original).toMatchObject({ code: "E900", email: "you@example.com", replayed: true })
  expect(guessed).toEqual(original)
})

test("再送の照合で保存済みのpassword資格情報を読まない", async () => {
  const c = await createRegisteredContext()
  await execSql(c.database, "DROP TABLE system_password_credentials")

  expect(await c.register("different-password-0002")).toMatchObject({
    code: "E900",
    replayed: true,
  })
})

test("password以外の登録内容が異なる再送は冪等keyの競合として拒否する", async () => {
  const c = await createRegisteredContext()
  await c.database
    .prepare("UPDATE company_personnel_actions SET payload_fingerprint = 'other' WHERE id = ?1")
    .bind("action-1")
    .run()

  expect(await c.register(ORIGINAL_PASSWORD)).toMatchObject({ code: "idempotency_conflict" })
})
