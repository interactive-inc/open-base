import { expect, test } from "vite-plus/test"
import { isPathOfDisabledFeature } from "@/lib/feature/is-path-of-disabled-feature"
import { getFeatureNavigationItems } from "@/lib/feature/get-feature-navigation-items"

test("disabled foundation feature matches only its own path", () => {
  expect(isPathOfDisabledFeature("/company/employees", ["employees"])).toBe(true)
  expect(isPathOfDisabledFeature("/company/employees/E001", ["employees"])).toBe(true)
  expect(isPathOfDisabledFeature("/company/employees-other", ["employees"])).toBe(false)
  expect(isPathOfDisabledFeature("/company/employees", [])).toBe(false)
})
test("navigation contains no business apps and filters disabled company items", () => {
  expect(getFeatureNavigationItems("apps", null)).toEqual([])
  expect(getFeatureNavigationItems("company", null).some((item) => item.slug === "employees")).toBe(
    true,
  )
  expect(
    getFeatureNavigationItems("company", null, ["employees"]).some(
      (item) => item.slug === "employees",
    ),
  ).toBe(false)
})
