import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { OrganizationResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-resource-adoption-snapshot.adapter"
import { OrganizationResourceAdoptionEntity } from "@/contexts/company/domain/entities/organization-resource-adoption.entity"
import { OrganizationResourceAdoptionRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-resource-adoption.repository"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { zApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("公開Companyから業務Taskへの接続", () => {
  test.each(["missing", "future", "agent", "locked"])(
    "会社の責務があっても、人のPrincipalを確認できない候補を採用しない: %s",
    async (kind) => {
      const c = await createGovernanceTaskTestContext()
      const person = c.people[1]
      const assignment = c.resources.find(
        (resource) => resource.type === "responsibility-assignment",
      )
      if (person === undefined || assignment === undefined)
        throw new Error("holder fixture is missing")
      await c.write([
        {
          ...assignment,
          revision: 2,
          attributes: {
            ...assignment.attributes,
            holderType: "employee",
            holderId: person.employeeId,
          },
        },
      ])
      const resolver = new ResolveCompanyGovernanceTaskAdapter(c.context)
      const input = {
        step: c.step,
        payload: { amount: 500 },
        subjectEmployeeId: c.creator.employeeId,
        excludedEmployeeIds: new Set([c.creator.employeeId]),
        openedAt: c.at,
        dueAt: null,
        resolvedAt: c.at,
      }
      const resolved = await resolver.resolve(input)
      if (resolved instanceof Error) throw resolved
      expect(resolved.task.candidates.map((candidate) => candidate.accountId)).toEqual([
        person.accountId,
      ])
      if (kind === "missing")
        await c.database
          .prepare("DELETE FROM system_principals WHERE account_id = ?1")
          .bind(person.accountId)
          .run()
      else if (kind === "locked")
        await c.database
          .prepare(
            "UPDATE system_accounts SET status = 'locked', token_version = token_version + 1 WHERE id = ?1",
          )
          .bind(person.accountId)
          .run()
      else if (kind === "agent")
        await c.database
          .prepare(
            "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = ?1",
          )
          .bind(person.accountId)
          .run()
      else
        await c.database
          .prepare(
            "UPDATE system_principals SET created_at = ?2, updated_at = ?2, revision = revision + 1 WHERE account_id = ?1",
          )
          .bind(person.accountId, c.at.getTime() + 1)
          .run()
      expect(await resolver.resolve(input)).toBeInstanceOf(Error)
    },
  )
  test.each(["employee", "organizational-office"])(
    "個人・役職への責務割当を候補と委任規則へ接続する: %s",
    async (holderType) => {
      const c = await createGovernanceTaskTestContext()
      const person = c.people[1]
      const assignment = c.resources.find(
        (resource) => resource.type === "responsibility-assignment",
      )
      if (person === undefined || assignment === undefined)
        throw new Error("holder fixture is missing")
      const changes: CompanyResourceProps[] = []
      if (holderType === "organizational-office") {
        const employmentId = await c.database
          .prepare(
            "SELECT resource_id FROM company_workforce_resource_bindings WHERE employee_id = ?1 AND resource_type = 'employment'",
          )
          .bind(person.employeeId)
          .first<string>("resource_id")
        if (employmentId === null) throw new Error("employment fixture is missing")
        const rootId = await c.database
          .prepare(
            "SELECT organization_unit_id FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
          )
          .first<string>("organization_unit_id")
        if (rootId === null) throw new Error("company root fixture missing")
        const snapshot = await new OrganizationResourceAdoptionSnapshotAdapter(c.database).find(
          rootId,
        )
        if (snapshot === null || snapshot instanceof Error) throw new Error("root snapshot missing")
        const adoption = OrganizationResourceAdoptionEntity.create({
          commandId: "governance-root-adoption",
          organizationUnitId: rootId,
          expectedRevision: snapshot.props.value.organizationRevision ?? 0,
          snapshotDigest: snapshot.props.digest,
          observedOn: assignment.effectiveFrom,
          reason: "Confirmed company root history",
          initializationConfirmation: {
            startsOn: "2020-01-01",
            evidenceReferences: [
              {
                context: "company",
                kind: "confirmed-test-history",
                id: "root-start",
                version: "1",
              },
            ],
          },
          actorAccountId: person.accountId,
          recordedAt: c.at.getTime(),
        })
        if (adoption instanceof Error) throw adoption
        const adopted = await new OrganizationResourceAdoptionRepository({
          env: c.context.env,
        }).adopt(adoption)
        if (adopted instanceof Error) throw adopted
        changes.push(
          {
            ...assignment,
            revision: 1,
            type: "organization-unit",
            id: "0190005f-0000-7000-8000-fd1e836c4a13",
            attributes: {
              organizationUnitId: "0190005f-0000-7000-8000-fd1e836c4a13",
              code: "REVIEW",
              officialName: "Review",
              kind: "DEPARTMENT",
              parentOrganizationUnitId: rootId,
            },
          },
          {
            ...assignment,
            revision: 1,
            type: "position",
            id: "position:review",
            attributes: { code: "REVIEWER", officialName: "Reviewer" },
          },
          {
            ...assignment,
            revision: 1,
            type: "organizational-office",
            id: "6db90b08-a99d-48a4-bd0b-118681c35009",
            attributes: {
              code: "REVIEWER",
              officialName: "Reviewer",
              organizationUnitId: "0190005f-0000-7000-8000-fd1e836c4a13",
              positionId: "position:review",
            },
          },
          {
            ...assignment,
            revision: 1,
            type: "office-assignment",
            id: "office-assignment:review",
            attributes: {
              employeeId: person.employeeId,
              employmentId,
              organizationalOfficeId: "6db90b08-a99d-48a4-bd0b-118681c35009",
            },
          },
        )
      }
      changes.push({
        ...assignment,
        revision: 2,
        attributes: {
          ...assignment.attributes,
          holderType,
          holderId:
            holderType === "employee" ? person.employeeId : "6db90b08-a99d-48a4-bd0b-118681c35009",
          delegationAllowed: true,
        },
      })
      await c.write(changes)
      const resolved = await new ResolveCompanyGovernanceTaskAdapter(c.context).resolve({
        step: c.step,
        payload: { amount: 500 },
        subjectEmployeeId: c.creator.employeeId,
        excludedEmployeeIds: new Set([c.creator.employeeId]),
        openedAt: c.at,
        dueAt: null,
        resolvedAt: c.at,
      })
      if (resolved instanceof Error) throw resolved
      expect(resolved.task).toMatchObject({
        requiredApprovals: 1,
        requiredParticipants: 1,
        delegationPolicy: "allowed",
        returnPolicy: "allowed",
      })
      expect(resolved.task.candidates.map((candidate) => candidate.accountId)).toEqual([
        person.accountId,
      ])
    },
  )

  test("保存制約を迂回して公開Account対応が破損した場合もTaskを作らない", async () => {
    const c = await createGovernanceTaskTestContext()
    const first = c.resources.find(
      (resource) =>
        resource.type === "account-employee-link" &&
        resource.attributes.accountId === c.people[1]?.accountId,
    )
    const second = c.resources.find(
      (resource) =>
        resource.type === "account-employee-link" &&
        resource.attributes.accountId === c.people[2]?.accountId,
    )
    if (first === undefined || second === undefined) throw new Error("link fixtures are missing")
    await execSql(c.database, "DROP TRIGGER company_account_employee_resource_owner_guard")
    // 対応の投影は別の相手への付け替えを中断するので、対応表も同じ形に壊してから公開側を書く。
    // 対応表の保護 trigger は製品の migration ごとに名前が異なるので、表から引いて外す。
    const guards = await c.database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'company_account_employee_links'",
      )
      .all<{ name: string }>()
    for (const guard of guards.results) await execSql(c.database, `DROP TRIGGER "${guard.name}"`)
    const swapped = [
      [first.attributes.accountId, second.attributes.employeeId],
      [second.attributes.accountId, first.attributes.employeeId],
    ] as const
    await c.database
      .prepare("DELETE FROM company_account_employee_links WHERE account_id IN (?1, ?2)")
      .bind(first.attributes.accountId, second.attributes.accountId)
      .run()
    for (const [accountId, employeeId] of swapped) {
      await c.database
        .prepare(
          "INSERT INTO company_account_employee_links (account_id, employee_id) VALUES (?1, ?2)",
        )
        .bind(accountId, employeeId)
        .run()
    }
    await c.write([
      {
        ...first,
        revision: 2,
        attributes: { ...first.attributes, accountId: second.attributes.accountId },
      },
      {
        ...second,
        revision: 2,
        attributes: { ...second.attributes, accountId: first.attributes.accountId },
      },
    ])
    expect(
      await new ResolveCompanyGovernanceTaskAdapter(c.context).resolve({
        step: c.step,
        payload: { amount: 500 },
        subjectEmployeeId: c.creator.employeeId,
        excludedEmployeeIds: new Set([c.creator.employeeId]),
        openedAt: c.at,
        dueAt: null,
        resolvedAt: c.at,
      }),
    ).toBeInstanceOf(Error)
  })

  test("金額と合議の規程を評価し、Systemへ候補と変更検知を渡す", async () => {
    const c = await createGovernanceTaskTestContext()
    const resolver = new ResolveCompanyGovernanceTaskAdapter(c.context)
    const input = {
      step: c.step,
      payload: { amount: 500 },
      subjectEmployeeId: c.creator.employeeId,
      excludedEmployeeIds: new Set([c.creator.employeeId]),
      openedAt: c.at,
      dueAt: null,
      resolvedAt: c.at,
    }
    const resolved = await resolver.resolve(input)
    if (resolved instanceof Error) throw resolved
    expect(resolved.task).toMatchObject({
      requiredApprovals: 2,
      requiredParticipants: 2,
      delegationPolicy: "forbidden",
      returnPolicy: "forbidden",
    })
    expect(resolved.task.candidates.map((candidate) => candidate.accountId).sort()).toEqual(
      c.people
        .slice(1)
        .map((person) => person.accountId)
        .sort(),
    )
    expect(await resolver.resolve({ ...input, payload: { amount: 1001 } })).toBeInstanceOf(Error)
    expect(await resolver.resolve({ ...input, payload: { amount: "500" } })).toBeInstanceOf(Error)
    const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
    if (assignment === undefined) throw new Error("assignment is missing")
    await c.write([{ ...assignment, revision: 2, state: "void" }])
    const failure = await c.database.batch([...resolved.guards]).then(
      () => null,
      (cause: unknown) => cause,
    )
    expect(failure).toBeInstanceOf(Error)
    expect(await resolver.resolve(input)).toBeInstanceOf(Error)
  })

  test("個別候補と人数の上書きを混在させず、定義を保存する", async () => {
    const c = await createGovernanceTaskTestContext()
    expect(zApplicationWorkflowStep.parse(c.step).governance_authority).toEqual(
      c.step.governance_authority,
    )
    expect(
      zApplicationWorkflowStep.safeParse({
        ...c.step,
        approval_mode: "minimum",
        minimum_approvals: 1,
      }).success,
    ).toBe(false)
    expect(
      zApplicationWorkflowStep.safeParse({ ...c.step, approvers: [{ type: "management_chain" }] })
        .success,
    ).toBe(false)
  })
})
