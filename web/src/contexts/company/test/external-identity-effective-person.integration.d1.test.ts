import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createExternalIdentityImportTestContext } from "@/contexts/company/test/external-identity-import.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test.each([false, true])(
  "将来の人物改訂と過去会社版を保持して現在情報を同期する: 監査失敗=%s",
  async (failAudit) => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    const repository = new D1CompanyResourceRepository({ database: c.database })
    const people = await repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["person"],
    })
    if (!people.ok || people.resources[0] === undefined) throw new Error("missing person")
    const person = people.resources[0]
    const today = resolveCompanyBusinessDate({
      now: c.clock.at.toISOString(),
      timeZone: "Asia/Tokyo",
    })
    if (today instanceof Error) throw today
    for (const future of [
      { revision: 1, date: "2100-01-01", name: "Future Name" },
      { revision: 2, date: "2101-01-01", name: "Later Name" },
    ]) {
      const planned = CompanyResourceChangeEntity.create({
        commandId: `future:name:${future.revision}`,
        expectedRevision: c.input.expectedRevision + future.revision,
        actorAccountId: c.actor.accountId,
        reason: "Confirmed future name",
        recordedAt: c.clock.at.getTime(),
        resources: [
          {
            ...person,
            revision: person.revision + future.revision,
            effectiveFrom: restoreCalendarDate(future.date),
            attributes: { ...person.attributes, officialName: future.name },
          },
        ],
      })
      if (planned instanceof Error) throw planned
      expect((await repository.write(planned)).kind).toBe("applied")
    }
    const beforeRevision = c.input.expectedRevision + 3
    const read = async (date: string, organizationRevision?: number) => {
      const result = await repository.findMany({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        types: ["person"],
        ids: [person.id],
        effectiveOn: restoreCalendarDate(date),
        organizationRevision,
      })
      if (!result.ok) throw result.cause
      return result.resources[0]
    }
    expect((await read(today))?.readText("officialName")).toBe("Example Person")
    const future = await read("2100-06-01")
    const later = await read("2101-06-01")
    const command = {
      ...c.input,
      commandId: "current:sync",
      expectedRevision: beforeRevision,
      identities: c.input.identities.map((identity) => ({
        ...identity,
        sourceRevision: 2,
        name: "Updated Current Name",
        email: "updated@example.com",
      })),
    }
    if (failAudit) {
      await execSql(
        c.database,
        "CREATE TRIGGER fail_current_identity_audit BEFORE INSERT ON system_audit_events WHEN NEW.action='company.external_identity.imported' BEGIN SELECT RAISE(ABORT,'injected failure'); END",
      )
      expect((await c.application.execute(command)).kind).toBe("unavailable")
      expect((await read(today))?.readText("officialName")).toBe("Example Person")
      expect(
        await c.database
          .prepare(
            `SELECT revision FROM company_organizations WHERE id='${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
          )
          .first<number>("revision"),
      ).toBe(beforeRevision)
      expect(
        await c.database
          .prepare("SELECT source_revision FROM company_external_identity_sources")
          .first<number>("source_revision"),
      ).toBe(1)
      expect(
        await c.database
          .prepare("SELECT email FROM system_identity_profiles")
          .first<string>("email"),
      ).toBe("you@example.com")
      await execSql(c.database, "DROP TRIGGER fail_current_identity_audit")
    }
    expect(await c.application.execute(command)).toMatchObject({
      kind: "applied",
      organizationRevision: beforeRevision + 1,
      replayed: false,
    })
    expect((await read(today))?.readText("officialName")).toBe("Updated Current Name")
    expect((await read(today))?.readText("email")).toBe("updated@example.com")
    expect((await read(today))?.revision).toBe(person.revision + 3)
    expect((await read(today, beforeRevision))?.readText("officialName")).toBe("Example Person")
    expect(await read("2100-06-01")).toEqual(future)
    expect(await read("2101-06-01")).toEqual(later)
    expect(await c.application.execute(command)).toMatchObject({
      kind: "applied",
      organizationRevision: beforeRevision + 1,
      replayed: true,
    })
    expect(
      (
        await c.application.execute({
          ...command,
          commandId: "stale:sync",
          identities: command.identities.map((identity) => ({ ...identity, sourceRevision: 3 })),
        })
      ).kind,
    ).toBe("conflict")
  },
)
