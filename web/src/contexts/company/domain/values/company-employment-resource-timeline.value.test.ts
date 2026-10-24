import { describe, expect, test } from "bun:test"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

function resource(
  revision: number,
  startsOn: string,
  overrides: Partial<CompanyResourceProps> = {},
) {
  const entity = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "employment",
    id: "employment:1",
    revision,
    state: "active",
    effectiveFrom: restoreCalendarDate(startsOn),
    effectiveTo: null,
    attributes: {
      employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
      employmentType: "FULL_TIME",
      status: "ACTIVE",
    },
    ...overrides,
  })
  if (entity instanceof Error) throw entity
  return entity
}

describe("版付き雇用と業務の期間履歴", () => {
  test("訂正された旧形式を履歴へ残し、同じ発効日の訂正版だけを現在の期間へ使う", () => {
    const old = {
      ...resource(1, "2026-01-01").toProps(),
      attributes: {
        employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
        employmentType: "FULL_TIME",
        status: "RETIRED",
      },
    }
    expect(CompanyEmploymentResourceTimelineValue.create([old])).toBeInstanceOf(Error)
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        old,
        resource(2, "2026-01-01", { effectiveTo: restoreCalendarDate("2026-08-17") }),
      ]),
    ).toMatchObject({
      revision: 2,
      periods: [{ startsOn: "2026-01-01", endsOn: "2026-08-17", status: "active" }],
    })
    expect(
      CompanyEmploymentResourceTimelineValue.create([old, resource(2, "2026-02-01")]),
    ).toBeInstanceOf(Error)
    expect(old.attributes.status).toBe("RETIRED")
  })

  test("入社日の遡及訂正は隣接する同じ在籍状態を一つの期間として参照する", () => {
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        resource(1, "2026-07-01"),
        resource(2, "2020-01-01"),
      ]),
    ).toMatchObject({
      revision: 2,
      periods: [{ startsOn: "2020-01-01", endsOn: null, status: "active" }],
    })
  })

  test("休職・復職・退職を発効日で区切り、現在時刻に依存せず予約を保持する", () => {
    const timeline = CompanyEmploymentResourceTimelineValue.create([
      resource(1, "2026-01-01"),
      resource(2, "2026-07-01", {
        attributes: {
          employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
          employmentType: "FULL_TIME",
          status: "ON_LEAVE",
        },
      }),
      resource(3, "2026-09-01"),
      resource(4, "2026-10-01", {
        attributes: {
          employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
          employmentType: "FULL_TIME",
          status: "TERMINATED",
        },
      }),
    ])
    expect(timeline).toMatchObject({
      employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
      startsOn: "2026-01-01",
      endsOn: "2026-10-01",
      periods: [
        { startsOn: "2026-01-01", endsOn: "2026-07-01", status: "active" },
        { startsOn: "2026-07-01", endsOn: "2026-09-01", status: "leave" },
        { startsOn: "2026-09-01", endsOn: "2026-10-01", status: "active" },
      ],
    })
  })

  test("同じ発効日の訂正は最新revisionを使う", () => {
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        resource(1, "2026-01-01", { effectiveTo: restoreCalendarDate("2026-10-01") }),
        resource(2, "2026-01-01", { effectiveTo: restoreCalendarDate("2026-11-01") }),
      ]),
    ).toMatchObject({
      periods: [{ startsOn: "2026-01-01", endsOn: "2026-11-01", status: "active" }],
    })
  })

  test("取消済みの雇用を古いrevisionから復活させない", () => {
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        resource(1, "2026-01-01"),
        resource(2, "2026-01-01", { state: "void" }),
      ]),
    ).toMatchObject({ startsOn: null, endsOn: null, periods: [] })
  })

  test("将来の取消はそれ以前の雇用事実を消さない", () => {
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        resource(1, "2026-01-01"),
        resource(2, "2026-10-01", { state: "void" }),
      ]),
    ).toMatchObject({
      periods: [{ startsOn: "2026-01-01", endsOn: "2026-10-01", status: "active" }],
    })
  })

  test("契約内の空白期間を在籍と推測しない", () => {
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        resource(1, "2026-01-01", { effectiveTo: restoreCalendarDate("2026-04-01") }),
        resource(2, "2026-05-01"),
      ]),
    ).toMatchObject({ code: "invalid_period" })
  })

  test("終了後の再雇用を同じEmploymentへ押し込めない", () => {
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        resource(1, "2026-01-01"),
        resource(2, "2026-04-01", {
          attributes: {
            employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
            employmentType: "FULL_TIME",
            status: "TERMINATED",
          },
        }),
        resource(3, "2026-05-01"),
      ]),
    ).toMatchObject({ code: "invalid_period" })
  })

  test("別人・別契約・別組織の履歴を混ぜない", () => {
    for (const changed of [
      resource(2, "2026-01-01", { organizationId: "01900060-0000-7000-8000-12268fccf2cc" }),
      resource(2, "2026-01-01", { id: "employment:other" }),
      resource(2, "2026-01-01", {
        attributes: {
          employeeId: "1953cffc-119b-42c7-bbab-82c56499e4ac",
          employmentType: "FULL_TIME",
          status: "ACTIVE",
        },
      }),
    ])
      expect(
        CompanyEmploymentResourceTimelineValue.create([resource(1, "2026-01-01"), changed]),
      ).toBeInstanceOf(Error)
  })

  test("欠けたrevisionと不明な雇用区分を補完しない", () => {
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        resource(1, "2026-01-01"),
        resource(3, "2026-02-01"),
      ]),
    ).toMatchObject({ code: "invalid_revision" })
    expect(() =>
      resource(1, "2026-01-01", {
        attributes: { employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1", status: "ACTIVE" },
      }),
    ).toThrow("invalid_resource")
  })

  test("同じ雇用の区分改定は在籍期間を分断せず、履歴を残す", () => {
    expect(
      CompanyEmploymentResourceTimelineValue.create([
        resource(1, "2026-01-01"),
        resource(2, "2026-04-01", {
          attributes: {
            employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
            employmentType: "PART_TIME",
            status: "ACTIVE",
          },
        }),
      ]),
    ).toMatchObject({ employmentType: "PART_TIME", startsOn: "2026-01-01", endsOn: null })
  })
})
