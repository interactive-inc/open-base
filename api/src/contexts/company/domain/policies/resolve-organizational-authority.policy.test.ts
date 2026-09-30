import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import { OrganizationalAuthorityError } from "@/contexts/company/domain/errors"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityReportingRelationEvidence,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { resolveOrganizationalAuthority } from "@/contexts/company/domain/policies/resolve-organizational-authority.policy"
import { listAssignmentManagementRelations } from "@/contexts/company/domain/policies/list-assignment-management-relations.policy"
import { resolveWorkforceManagementRelations } from "@/contexts/company/domain/policies/resolve-workforce-management-relations.policy"
import type { WorkforceStateProps } from "@/contexts/company/domain/values/workforce-state.value"
import type {
  AccountEmployeeLink,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"

const asOf = restoreCalendarDate("2026-06-01")
const startsOn = restoreCalendarDate("2026-01-01")
const subjectId = employeeId("employee-1")
const managerId = employeeId("employee-2")
const executiveId = employeeId("employee-3")
const organizationManagerId = employeeId("employee-4")
const inactiveId = employeeId("employee-5")
const productId = organizationUnitId("organization-product")
const financeId = organizationUnitId("organization-finance")

function employeeId(value: string): EmployeeId {
  return restoreWorkforceId("employee", testLiteralId(value))
}

function organizationUnitId(value: string): OrganizationUnitId {
  return restoreWorkforceId("organization_unit", testLiteralId(value))
}

function assignment(props: {
  employeeId: EmployeeId
  managerEmployeeId: EmployeeId | null
  organizationUnitId: OrganizationUnitId
  suffix?: string
  assignmentType?: "PRIMARY" | "CONCURRENT"
}): OrgAssignmentPeriod {
  const suffix = props.suffix ?? "primary"

  return {
    periodId: restoreWorkforceId(
      "period",
      testLiteralId(`assignment-${props.employeeId}-${suffix}`),
    ),
    revision: 3,
    startsOn,
    endsOn: null,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", testLiteralId("action-fixture")),
    recordedAt: 1,
    employmentId: restoreWorkforceId("employment", testLiteralId(`employment-${props.employeeId}`)),
    employeeId: props.employeeId,
    organizationUnitId: props.organizationUnitId,
    assignmentType: props.assignmentType ?? "PRIMARY",
    positionTitle: null,
    managerEmployeeId: props.managerEmployeeId,
  }
}

function responsibility(props: {
  employeeId: EmployeeId
  organizationUnitId: OrganizationUnitId
  responsibilityType?: string
}): OrgResponsibilityPeriod {
  const responsibilityType = props.responsibilityType ?? "MANAGER"
  return {
    periodId: restoreWorkforceId(
      "period",
      testLiteralId(
        `responsibility-${props.employeeId}-${props.organizationUnitId}-${responsibilityType}`,
      ),
    ),
    revision: 4,
    startsOn,
    endsOn: null,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", testLiteralId("action-fixture")),
    recordedAt: 1,
    employmentId: restoreWorkforceId("employment", testLiteralId(`employment-${props.employeeId}`)),
    employeeId: props.employeeId,
    organizationUnitId: props.organizationUnitId,
    responsibilityType: restoreOrgResponsibilityType(responsibilityType),
  }
}

function state(props: {
  employeeId: EmployeeId
  managerEmployeeId?: EmployeeId | null
  organizationUnitId?: OrganizationUnitId
  concurrentAssignments?: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities?: ReadonlyArray<OrgResponsibilityPeriod>
  status?: "ACTIVE" | "ON_LEAVE" | "TERMINATED"
  stateAsOf?: WorkforceStateProps["asOf"]
}): WorkforceStateProps {
  const status = props.status ?? "ACTIVE"
  const employmentId =
    status === "TERMINATED"
      ? null
      : restoreWorkforceId("employment", testLiteralId(`employment-${props.employeeId}`))
  const primaryAssignment =
    status === "TERMINATED" || props.organizationUnitId === undefined
      ? null
      : assignment({
          employeeId: props.employeeId,
          managerEmployeeId: props.managerEmployeeId ?? null,
          organizationUnitId: props.organizationUnitId,
        })

  return {
    employeeId: props.employeeId,
    asOf: props.stateAsOf ?? asOf,
    status,
    employmentId,
    primaryAssignment,
    concurrentAssignments: status === "TERMINATED" ? [] : (props.concurrentAssignments ?? []),
    responsibilities: status === "TERMINATED" ? [] : (props.responsibilities ?? []),
  }
}

function link(employee: EmployeeId, account: string = `account-${employee}`): AccountEmployeeLink {
  return {
    employeeId: employee,
    accountId: restoreWorkforceId("system_account", testLiteralId(account)),
  }
}

function baseProjection(
  overrides: Partial<OrganizationalAuthorityProjection> = {},
): OrganizationalAuthorityProjection {
  const states = [
    state({ employeeId: subjectId, managerEmployeeId: managerId, organizationUnitId: productId }),
    state({ employeeId: managerId, managerEmployeeId: executiveId, organizationUnitId: productId }),
    state({
      employeeId: executiveId,
      organizationUnitId: financeId,
      responsibilities: [
        responsibility({ employeeId: executiveId, organizationUnitId: financeId }),
        responsibility({
          employeeId: executiveId,
          organizationUnitId: financeId,
          responsibilityType: "PEOPLE_OPERATIONS",
        }),
      ],
    }),
    state({
      employeeId: organizationManagerId,
      organizationUnitId: productId,
      responsibilities: [
        responsibility({ employeeId: organizationManagerId, organizationUnitId: productId }),
      ],
    }),
    state({ employeeId: inactiveId, status: "TERMINATED" }),
  ]

  return {
    snapshot: {
      schemaVersion: 1,
      source: "lifecycle",
      asOf,
      organizationRevision: 7,
      companyRevision: 5,
    },
    subjectEmployeeId: subjectId,
    criteria: [],
    states,
    managementRelations: listAssignmentManagementRelations(overrides.states ?? states),
    accountLinks: states.map((item) => link(item.employeeId)),
    ...overrides,
  }
}

function expectError(
  projection: OrganizationalAuthorityProjection,
  code: OrganizationalAuthorityError["code"],
): void {
  const result = resolveOrganizationalAuthority(projection)

  expect(result).toBeInstanceOf(OrganizationalAuthorityError)
  expect(result).toMatchObject({ code })
}

function reportingRelation(
  id: string,
  employee: EmployeeId,
  manager: EmployeeId,
): OrganizationalAuthorityReportingRelationEvidence {
  return {
    reportingRelationId: id,
    reportingRelationRevision: 2,
    employeeId: employee,
    managerEmployeeId: manager,
    organizationUnitId: productId,
    asOf,
  }
}

describe("resolveOrganizationalAuthority", () => {
  test("requires the observed Company revision for independent reporting evidence", () => {
    expectError(
      baseProjection({
        snapshot: { ...baseProjection().snapshot, companyRevision: undefined },
        managementRelations: [reportingRelation("relation", subjectId, managerId)],
      }),
      "organizational_authority_snapshot_invalid",
    )
  })

  test("rejects overlapping legacy and public ownership even when the managers agree", () => {
    for (const manager of [managerId, executiveId]) {
      expect(
        resolveWorkforceManagementRelations({
          states: baseProjection().states,
          reportingRelations: [reportingRelation("relation", subjectId, manager)],
        }),
      ).toMatchObject({ code: "organizational_authority_reporting_source_conflict" })
    }
  })

  test("combines distinct scopes while checking cycles across both sources", () => {
    const projection = baseProjection({ criteria: [{ kind: "direct_manager" }] })
    const combined = resolveWorkforceManagementRelations({
      states: projection.states,
      reportingRelations: [
        { ...reportingRelation("relation", subjectId, executiveId), organizationUnitId: financeId },
      ],
    })
    if (combined instanceof Error) throw combined
    const resolved = resolveOrganizationalAuthority({
      ...projection,
      managementRelations: combined,
    })
    if (resolved instanceof Error) throw resolved
    expect(resolved.candidates.map((candidate) => candidate.employeeId)).toEqual([
      managerId,
      executiveId,
    ])

    const cyclic = resolveWorkforceManagementRelations({
      states: projection.states,
      reportingRelations: [reportingRelation("cycle", executiveId, subjectId)],
    })
    if (cyclic instanceof Error) throw cyclic
    expectError(
      { ...projection, managementRelations: cyclic },
      "organizational_authority_manager_cycle",
    )
  })

  test("resolves multiple managers in one unit without creating assignments", () => {
    const relations = [
      reportingRelation("relation-2", subjectId, organizationManagerId),
      reportingRelation("relation-1", subjectId, executiveId),
    ]
    const projection = baseProjection({
      criteria: [{ kind: "direct_manager" }],
      managementRelations: relations,
    })
    const before = structuredClone(projection)
    // 候補は上長のEmployee IDの順に並ぶ
    const expectedCandidates = [
      {
        employeeId: executiveId,
        accountId: link(executiveId).accountId,
        qualification: {
          criterionIndex: 0,
          evidence: { kind: "direct_manager" as const, reportingRelation: relations[1] },
        },
      },
      {
        employeeId: organizationManagerId,
        accountId: link(organizationManagerId).accountId,
        qualification: {
          criterionIndex: 0,
          evidence: { kind: "direct_manager" as const, reportingRelation: relations[0] },
        },
      },
    ].sort((left, right) => left.employeeId.localeCompare(right.employeeId))
    expect(resolveOrganizationalAuthority(projection)).toEqual({
      snapshot: projection.snapshot,
      candidates: expectedCandidates,
    })
    expect(projection).toEqual(before)
    expect(projection.states[0]?.concurrentAssignments).toEqual([])
  })

  test("does not restore assignment managers when explicit relations are empty", () => {
    const projection = baseProjection({
      criteria: [{ kind: "direct_manager" }, { kind: "management_chain" }],
      managementRelations: [],
    })
    expect(resolveOrganizationalAuthority(projection)).toEqual({
      snapshot: projection.snapshot,
      candidates: [],
    })
  })

  test("preserves assignment provenance exactly for existing callers", () => {
    const projection = baseProjection({ criteria: [{ kind: "direct_manager" }] })
    expect(resolveOrganizationalAuthority(projection)).toEqual({
      snapshot: projection.snapshot,
      candidates: [
        {
          employeeId: managerId,
          accountId: link(managerId).accountId,
          qualification: {
            criterionIndex: 0,
            evidence: {
              kind: "direct_manager",
              assignment: {
                employeeId: subjectId,
                managerEmployeeId: managerId,
                organizationUnitId: productId,
                assignmentPeriodId: restoreWorkforceId(
                  "period",
                  testLiteralId(`assignment-${subjectId}-primary`),
                ),
                assignmentRevision: 3,
                asOf,
              },
            },
          },
        },
      ],
    })
  })

  test("uses deterministic relation paths through a branching management chain", () => {
    const first = reportingRelation("first", subjectId, managerId)
    const second = reportingRelation("second", subjectId, executiveId)
    const third = reportingRelation("third", managerId, organizationManagerId)
    const fourth = reportingRelation("fourth", executiveId, organizationManagerId)
    const projection = baseProjection({
      criteria: [{ kind: "management_chain" }],
      managementRelations: [fourth, second, third, first],
    })
    const result = resolveOrganizationalAuthority(projection)
    expect(result).toEqual(
      resolveOrganizationalAuthority({
        ...projection,
        managementRelations: [...projection.managementRelations].reverse(),
        states: [...projection.states].reverse(),
      }),
    )
    expect(result).toMatchObject({
      candidates: [
        { employeeId: managerId, qualification: { evidence: { path: [first] } } },
        { employeeId: executiveId, qualification: { evidence: { path: [second] } } },
        {
          employeeId: organizationManagerId,
          qualification: { evidence: { path: [first, third] } },
        },
      ],
    })
  })

  test("rejects a cycle among independent relations including self management", () => {
    for (const relations of [
      [reportingRelation("self", subjectId, subjectId)],
      [
        reportingRelation("a", subjectId, managerId),
        reportingRelation("b", managerId, executiveId),
        reportingRelation("c", executiveId, subjectId),
      ],
    ]) {
      expectError(
        baseProjection({ managementRelations: relations }),
        "organizational_authority_manager_cycle",
      )
    }
  })

  test("rejects missing or inactive relation endpoints", () => {
    for (const missing of [employeeId("employee-missing"), inactiveId]) {
      for (const relation of [
        reportingRelation("relation", missing, managerId),
        reportingRelation("relation", subjectId, missing),
      ]) {
        expectError(
          baseProjection({ managementRelations: [relation] }),
          missing === inactiveId
            ? "organizational_authority_state_invalid"
            : "organizational_authority_employee_reference_missing",
        )
      }
    }
  })

  test("rejects relations from another date and unresolved duplicate source versions", () => {
    const relation = reportingRelation("relation", subjectId, managerId)
    expectError(
      baseProjection({
        managementRelations: [{ ...relation, asOf: restoreCalendarDate("2026-06-02") }],
      }),
      "organizational_authority_state_as_of_mismatch",
    )
    expectError(
      baseProjection({
        managementRelations: [relation, { ...relation, reportingRelationRevision: 3 }],
      }),
      "organizational_authority_period_duplicate",
    )
    for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expectError(
        baseProjection({
          managementRelations: [{ ...relation, reportingRelationRevision: revision }],
        }),
        "organizational_authority_period_invalid",
      )
    }
  })

  test("rejects assignment evidence that changes its manager, unit, or source revision", () => {
    const relation = baseProjection().managementRelations[0]!
    for (const changed of [
      { ...relation, managerEmployeeId: executiveId },
      { ...relation, organizationUnitId: financeId },
      { ...relation, assignmentRevision: 4 },
      { ...relation, assignmentPeriodId: restoreWorkforceId("period", testLiteralId("missing")) },
    ]) {
      expectError(
        baseProjection({ managementRelations: [changed] }),
        "organizational_authority_period_invalid",
      )
    }
  })

  test("resolves every canonical criterion in criterion and opaque ID order", () => {
    const criteria: ReadonlyArray<OrganizationalAuthorityCriterion> = [
      { kind: "direct_manager" },
      { kind: "subject_organization_manager" },
      { kind: "target_organization_manager", organizationUnitId: financeId },
      { kind: "management_chain" },
      {
        kind: "responsibility",
        responsibilityType: restoreOrgResponsibilityType("PEOPLE_OPERATIONS"),
        organizationUnitId: null,
      },
      { kind: "employee", employeeId: organizationManagerId },
    ]
    const result = resolveOrganizationalAuthority(baseProjection({ criteria }))

    expect(result).not.toBeInstanceOf(Error)
    expect(result).toMatchObject({
      snapshot: { source: "lifecycle", asOf, organizationRevision: 7 },
      candidates: [
        {
          employeeId: managerId,
          qualification: {
            criterionIndex: 0,
            evidence: {
              kind: "direct_manager",
              assignment: {
                employeeId: subjectId,
                managerEmployeeId: managerId,
                organizationUnitId: productId,
                assignmentRevision: 3,
                asOf,
              },
            },
          },
        },
        {
          employeeId: organizationManagerId,
          qualification: {
            criterionIndex: 1,
            evidence: {
              kind: "organization_manager",
              scope: "subject",
              responsibility: {
                employeeId: organizationManagerId,
                organizationUnitId: productId,
                responsibilityRevision: 4,
                asOf,
              },
            },
          },
        },
        {
          employeeId: executiveId,
          qualification: {
            criterionIndex: 2,
            evidence: { kind: "organization_manager", scope: "target" },
          },
        },
        {
          employeeId: managerId,
          qualification: {
            criterionIndex: 3,
            evidence: { kind: "management_chain", path: [{ managerEmployeeId: managerId }] },
          },
        },
        {
          employeeId: executiveId,
          qualification: {
            criterionIndex: 3,
            evidence: {
              kind: "management_chain",
              path: [{ managerEmployeeId: managerId }, { managerEmployeeId: executiveId }],
            },
          },
        },
        {
          employeeId: executiveId,
          qualification: {
            criterionIndex: 4,
            evidence: {
              kind: "responsibility",
              responsibility: {
                employeeId: executiveId,
                organizationUnitId: financeId,
                responsibilityType: "PEOPLE_OPERATIONS",
              },
            },
          },
        },
        {
          employeeId: organizationManagerId,
          qualification: { criterionIndex: 5, evidence: { kind: "employee" } },
        },
      ],
    })
  })

  test("keeps zero candidates distinct from an invalid projection", () => {
    const result = resolveOrganizationalAuthority(
      baseProjection({
        subjectEmployeeId: null,
        criteria: [
          { kind: "direct_manager" },
          { kind: "subject_organization_manager" },
          { kind: "management_chain" },
        ],
      }),
    )

    expect(result).toEqual({ snapshot: baseProjection().snapshot, candidates: [] })
  })

  test("excludes self, inactive employees, and employees without an Account link", () => {
    const result = resolveOrganizationalAuthority(
      baseProjection({
        criteria: [
          { kind: "employee", employeeId: subjectId },
          { kind: "employee", employeeId: inactiveId },
          { kind: "employee", employeeId: organizationManagerId },
        ],
        accountLinks: [link(subjectId), link(inactiveId)],
      }),
    )

    expect(result).toEqual({ snapshot: baseProjection().snapshot, candidates: [] })
  })

  test("is deterministic when states, links, and concurrent assignments arrive unordered", () => {
    const branchManagerId = employeeId("employee-6")
    const concurrent = assignment({
      employeeId: subjectId,
      managerEmployeeId: branchManagerId,
      organizationUnitId: financeId,
      suffix: "concurrent",
      assignmentType: "CONCURRENT",
    })
    const projection = baseProjection({
      criteria: [{ kind: "management_chain" }],
      states: [
        state({ employeeId: branchManagerId }),
        ...baseProjection().states.map((item) =>
          item.employeeId === subjectId
            ? state({
                employeeId: subjectId,
                managerEmployeeId: managerId,
                organizationUnitId: productId,
                concurrentAssignments: [concurrent],
              })
            : item,
        ),
      ].reverse(),
      accountLinks: [link(branchManagerId), ...baseProjection().accountLinks].reverse(),
    })

    const first = resolveOrganizationalAuthority(projection)
    const second = resolveOrganizationalAuthority({
      ...projection,
      states: [...projection.states].reverse(),
      accountLinks: [...projection.accountLinks].reverse(),
    })

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      candidates: [
        { employeeId: managerId },
        { employeeId: branchManagerId },
        { employeeId: executiveId },
      ],
    })
  })

  test("rejects a cycle anywhere in the loaded management graph", () => {
    expectError(
      baseProjection({
        states: baseProjection().states.map((item) =>
          item.employeeId === executiveId
            ? state({
                employeeId: executiveId,
                managerEmployeeId: subjectId,
                organizationUnitId: financeId,
              })
            : item,
        ),
      }),
      "organizational_authority_manager_cycle",
    )
  })

  test("rejects duplicate Employee states and mismatched business dates", () => {
    expectError(
      baseProjection({ states: [...baseProjection().states, baseProjection().states[0]!] }),
      "organizational_authority_employee_duplicate",
    )
    expectError(
      baseProjection({
        states: baseProjection().states.map((item) =>
          item.employeeId === subjectId
            ? { ...item, asOf: restoreCalendarDate("2026-06-02") }
            : item,
        ),
      }),
      "organizational_authority_state_as_of_mismatch",
    )
  })

  test("rejects period ownership drift, duplicate periods, and dangling managers", () => {
    const subject = baseProjection().states[0]!
    const manager = baseProjection().states[1]!
    expectError(
      baseProjection({
        states: [
          {
            ...subject,
            primaryAssignment: { ...subject.primaryAssignment!, employeeId: managerId },
          },
          ...baseProjection().states.slice(1),
        ],
      }),
      "organizational_authority_period_invalid",
    )
    expectError(
      baseProjection({
        states: [
          subject,
          {
            ...manager,
            primaryAssignment: {
              ...manager.primaryAssignment!,
              periodId: subject.primaryAssignment!.periodId,
            },
          },
          ...baseProjection().states.slice(2),
        ],
      }),
      "organizational_authority_period_duplicate",
    )
    expectError(
      baseProjection({
        states: [
          {
            ...subject,
            primaryAssignment: {
              ...subject.primaryAssignment!,
              managerEmployeeId: employeeId("employee-missing"),
            },
          },
          ...baseProjection().states.slice(1),
        ],
      }),
      "organizational_authority_employee_reference_missing",
    )
  })

  test("rejects an inactive manager and a responsibility without an assignment", () => {
    expectError(
      baseProjection({
        states: baseProjection().states.map((item) =>
          item.employeeId === managerId
            ? state({ employeeId: managerId, status: "TERMINATED" })
            : item,
        ),
      }),
      "organizational_authority_state_invalid",
    )
    expectError(
      baseProjection({
        states: baseProjection().states.map((item) =>
          item.employeeId === organizationManagerId ? { ...item, primaryAssignment: null } : item,
        ),
      }),
      "organizational_authority_period_invalid",
    )
  })

  test("rejects ambiguous or dangling Account links", () => {
    expectError(
      baseProjection({
        accountLinks: [...baseProjection().accountLinks, link(subjectId, "account-another")],
      }),
      "organizational_authority_account_employee_duplicate",
    )
    expectError(
      baseProjection({
        accountLinks: [link(subjectId, "account-shared"), link(managerId, "account-shared")],
      }),
      "organizational_authority_account_duplicate",
    )
    expectError(
      baseProjection({
        accountLinks: [link(employeeId("employee-missing"))],
      }),
      "organizational_authority_account_employee_missing",
    )
  })

  test("rejects missing subject and explicit Employee references", () => {
    expectError(
      baseProjection({ subjectEmployeeId: employeeId("employee-missing") }),
      "organizational_authority_subject_missing",
    )
    expectError(
      baseProjection({
        criteria: [{ kind: "employee", employeeId: employeeId("employee-missing") }],
      }),
      "organizational_authority_employee_reference_missing",
    )
  })

  test("requires a nonnegative lifecycle revision", () => {
    expectError(
      baseProjection({
        snapshot: { ...baseProjection().snapshot, organizationRevision: -1 },
      }),
      "organizational_authority_snapshot_invalid",
    )
  })
})
