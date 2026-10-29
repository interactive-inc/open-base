import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { drizzle } from "drizzle-orm/d1"
import { schema } from "@/schema"
import type { HonoEnv } from "@/env"
import { POST } from "@/api/routes/company.notifications"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { NotifyApprovalResult } from "@/api/http/notifications/notify-approval-result"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"

setDefaultTimeout(30_000)

async function fixture(sessionBound = false) {
  const company = await createGovernanceTaskTestContext()
  const recipient = company.people[1]
  if (recipient === undefined) throw new Error("recipient fixture missing")
  const recipientCode = "EXAMPLE-RECIPIENT"
  const workforce = await new D1CompanyResourceRepository({ database: company.database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employee"],
  })
  if (!workforce.ok) throw workforce.cause
  const employee = workforce.resources.find((resource) => resource.id === recipient.employeeId)
  if (employee === undefined || employee.type !== "employee")
    throw new Error("employee fixture missing")
  const currentEmployee = {
    ...employee.toProps(),
    revision: employee.revision + 1,
    attributes: { ...employee.attributes, employeeCode: recipientCode },
  }
  await company.write([currentEmployee])
  await company.database
    .prepare(
      "INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d','notification:send')",
    )
    .run()
  const familyId = crypto.randomUUID()
  if (sessionBound)
    await company.database
      .prepare(`INSERT INTO system_sessions
    (id,account_id,family_id,token_hash,token_version,created_at,expires_at)
    VALUES (?1,?2,?3,?4,0,?5,?6)`)
      .bind(
        crypto.randomUUID(),
        company.creator.accountId,
        familyId,
        "a".repeat(64),
        company.at.getTime() - 1000,
        company.at.getTime() + 604800000,
      )
      .run()
  const token = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
    {
      accountId: company.creator.accountId,
      tokenVersion: 0,
      ...(sessionBound ? { sessionFamilyId: familyId } : {}),
    },
    "example-company-notification-secret",
    new Date(company.at.getTime() - 1000),
  )
  if (token instanceof Error) throw token
  const app = new Hono<HonoEnv>()
    .use("*", async (context, next) => {
      context.set("database", drizzle(company.database, { schema }))
      context.set("auditContext", company.context.var.auditContext)
      context.set("session", null)
      context.set("now", () => company.at)
      await next()
    })
    .onError((error) => {
      if (error instanceof HTTPException) return error.getResponse()
      throw error
    })
    .post("/company/notifications", ...POST)
  const environment = {
    ...company.context.env,
    JWT_SECRET: "example-company-notification-secret",
    AUDIT_HMAC_SECRET: "example-company-notification-audit-secret",
  }
  const send = (code = recipientCode) =>
    app.request(
      "/company/notifications",
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ recipient_employee_code: code, title: "Example notification" }),
      },
      environment,
    )
  const counts = async () => ({
    messages: await company.database
      .prepare("SELECT count(*) AS total FROM system_notification_messages")
      .first<number>("total"),
    deliveries: await company.database
      .prepare("SELECT count(*) AS total FROM system_notification_deliveries")
      .first<number>("total"),
  })
  return { company, environment, send, counts, familyId, employee: currentEmployee, recipient }
}

test("Companyの通知送信は現在の送信権限と宛先Accountで一件を保存する", async () => {
  const f = await fixture()
  expect((await f.send()).status).toBe(201)
  expect(await f.counts()).toEqual({ messages: 1, deliveries: 1 })
})

test("社員コード解決中に送信権限が失効した場合は通知を保存しない", async () => {
  const f = await fixture()
  const directory = new CompanyEmployeeDirectoryReadAdapter({ env: f.environment })
  const original = directory.findByCode.bind(directory)
  const lookup = spyOn(
    CompanyEmployeeDirectoryReadAdapter.prototype,
    "findByCode",
  ).mockImplementation(async (...args) => {
    const recipient = await original(...args)
    await f.company.database
      .prepare("DELETE FROM system_iam_role_permissions WHERE permission_key='notification:send'")
      .run()
    return recipient
  })
  try {
    expect((await f.send()).status).not.toBe(201)
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(await f.counts()).toEqual({ messages: 0, deliveries: 0 })
  } finally {
    lookup.mockRestore()
  }
})

for (const invalidation of [
  "account-version",
  "logout",
  "expiry",
  "recipient-code",
  "sender-link",
]) {
  test(`宛先解決中の${invalidation}を保存時に拒否する`, async () => {
    const f = await fixture(invalidation === "logout")
    const directory = new CompanyEmployeeDirectoryReadAdapter({ env: f.environment })
    const original = directory.findByCode.bind(directory)
    const lookup = spyOn(
      CompanyEmployeeDirectoryReadAdapter.prototype,
      "findByCode",
    ).mockImplementation(async (...args) => {
      const recipient = await original(...args)
      if (invalidation === "account-version")
        await f.company.database
          .prepare("UPDATE system_accounts SET token_version=1 WHERE id=?1")
          .bind(f.company.creator.accountId)
          .run()
      if (invalidation === "logout")
        await f.company.database
          .prepare("UPDATE system_sessions SET revoked_at=?2 WHERE family_id=?1")
          .bind(f.familyId, Date.now())
          .run()
      if (invalidation === "expiry")
        f.environment.NOW = new Date(f.company.at.getTime() + 3600000).toISOString()
      if (invalidation === "recipient-code")
        await f.company.write([
          {
            ...f.employee,
            revision: f.employee.revision + 1,
            attributes: { ...f.employee.attributes, employeeCode: "EXAMPLE-CHANGED" },
          },
        ])
      if (invalidation === "sender-link") {
        const link = f.company.resources.find(
          (resource) =>
            resource.type === "account-employee-link" &&
            resource.attributes.accountId === f.company.creator.accountId,
        )
        if (link === undefined) throw new Error("sender link missing")
        await f.company.write([{ ...link, revision: link.revision + 1, state: "void" }])
      }
      return recipient
    })
    try {
      expect((await f.send()).status).not.toBe(201)
      expect(lookup).toHaveBeenCalledTimes(1)
      expect(await f.counts()).toEqual({ messages: 0, deliveries: 0 })
    } finally {
      lookup.mockRestore()
    }
    if (invalidation === "recipient-code") {
      expect((await f.send("EXAMPLE-CHANGED")).status).toBe(201)
      expect(await f.counts()).toEqual({ messages: 1, deliveries: 1 })
    }
  })
}

test("保存中の送信者失権は通知・配送と共に取消し、修正後に再試行できる", async () => {
  const f = await fixture()
  const permissionsBefore = await f.company.database
    .prepare(
      "SELECT count(*) AS total FROM system_iam_role_permissions WHERE permission_key='notification:send'",
    )
    .first<number>("total")
  await f.company.database
    .prepare(`CREATE TRIGGER revoke_notification_sender AFTER INSERT ON system_notification_messages
    BEGIN DELETE FROM system_iam_role_permissions WHERE permission_key='notification:send'; END`)
    .run()
  expect((await f.send()).status).not.toBe(201)
  expect(await f.counts()).toEqual({ messages: 0, deliveries: 0 })
  expect(
    await f.company.database
      .prepare(
        "SELECT count(*) AS total FROM system_iam_role_permissions WHERE permission_key='notification:send'",
      )
      .first<number>("total"),
  ).toBe(permissionsBefore)
  await f.company.database.prepare("DROP TRIGGER revoke_notification_sender").run()
  expect((await f.send()).status).toBe(201)
  expect(await f.counts()).toEqual({ messages: 1, deliveries: 1 })
})

test("決定済みの結果通知は手動送信の資格を要求しない", async () => {
  const f = await fixture()
  await f.company.database
    .prepare("DELETE FROM system_iam_role_permissions WHERE permission_key='notification:send'")
    .run()
  const notification = await new NotifyApprovalResult({
    env: f.environment,
    var: {
      ...f.company.context.var,
      database: drizzle(f.company.database, { schema }),
      session: null,
    },
  }).run({
    recipientEmployeeId: f.recipient.employeeId,
    action: "approve",
    subjectLabel: "Example decision",
    sourceDomain: "example",
    sourceId: null,
    createdAt: f.company.at.toISOString(),
  })
  expect(notification).not.toBeInstanceOf(Error)
  expect(await f.counts()).toEqual({ messages: 1, deliveries: 1 })
})
