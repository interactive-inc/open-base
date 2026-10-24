import { expect, test } from "bun:test"
import {
  COMPANY_DEFAULT_ORGANIZATION_ID,
  COMPANY_ROOT_ORGANIZATION_UNIT_ID,
} from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// 既存の導入の記録と migration がこの値を指すため、値を変えると既存の組織を辿れなくなる。
test("会社組織と最上位の組織単位の ID は既知の UUID に固定されている", () => {
  expect(COMPANY_DEFAULT_ORGANIZATION_ID).toBe("ad4f6cb1-774b-43ae-950f-80e9bc67c66d")
  expect(COMPANY_ROOT_ORGANIZATION_UNIT_ID).toBe("282ccd01-cb30-4d0a-84b4-c675bbbe473c")
})
