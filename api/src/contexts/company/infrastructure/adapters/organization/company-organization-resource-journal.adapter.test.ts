import type { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { CompanyOrganizationResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-organization-resource-journal.adapter"
import { describe, expect, test } from "bun:test"

/** 拒否が接続台帳の状態に依存しないことを示すため、DBへ触れた時点で失敗させる。 */
const untouchableDatabase = new Proxy(
  {},
  {
    get() {
      throw new Error("database must not be read")
    },
  },
) as D1Database

function changeWith(
  props: Pick<OrganizationWorkforceChangeEntity, "assignments" | "responsibilities">,
): OrganizationWorkforceChangeEntity {
  return {
    unitPeriods: [],
    organizationUnits: [],
    ...props,
  } as unknown as OrganizationWorkforceChangeEntity
}

describe("既存の組織変更の公開履歴への反映", () => {
  test("所属を含む変更は旧台帳だけへ保存させず拒否する", async () => {
    const assignment = {
      periodId: "assignment-period:1",
    } as OrganizationWorkforceChangeEntity["assignments"][number]
    const result = await new CompanyOrganizationResourceJournalAdapter(untouchableDatabase).prepare(
      changeWith({ assignments: [assignment], responsibilities: [] }),
    )

    expect(result).toBeInstanceOf(CompanyValidationError)
  })

  test("責務を含む変更は旧台帳だけへ保存させず拒否する", async () => {
    const responsibility = {
      periodId: "responsibility-period:1",
    } as OrganizationWorkforceChangeEntity["responsibilities"][number]
    const result = await new CompanyOrganizationResourceJournalAdapter(untouchableDatabase).prepare(
      changeWith({ assignments: [], responsibilities: [responsibility] }),
    )

    expect(result).toBeInstanceOf(CompanyValidationError)
  })

  test("期間を含まない変更は公開履歴を作らない", async () => {
    const result = await new CompanyOrganizationResourceJournalAdapter(untouchableDatabase).prepare(
      changeWith({ assignments: [], responsibilities: [] }),
    )

    expect(result).toEqual([])
  })
})
