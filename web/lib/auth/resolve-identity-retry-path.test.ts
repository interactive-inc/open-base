import { expect, test } from "vite-plus/test"
import { resolveIdentityRetryPath } from "@/lib/auth/resolve-identity-retry-path"

test("step-up retry preserves its purpose and original local screen", () => {
  expect(
    resolveIdentityRetryPath({
      isConfigured: true,
      purpose: "step-up",
      returnTo: "/system/roles?tab=permissions",
    }),
  ).toBe("/auth/broker/login?purpose=step-up&return_to=%2Fsystem%2Froles%3Ftab%3Dpermissions")
})

test.each([
  "https://other.example.com",
  "//other.example.com",
  "/\\other.example.com",
  "/\nunsafe",
])("unsafe retry target %s falls back to the local root", (returnTo) => {
  expect(resolveIdentityRetryPath({ isConfigured: true, purpose: "step-up", returnTo })).toBe(
    "/auth/broker/login?purpose=step-up&return_to=%2F",
  )
})

test("ordinary login and unconfigured login retain their original retry routes", () => {
  expect(
    resolveIdentityRetryPath({ isConfigured: true, purpose: null, returnTo: "/system/roles" }),
  ).toBe("/auth/broker/login")
  expect(
    resolveIdentityRetryPath({
      isConfigured: false,
      purpose: "step-up",
      returnTo: "/system/roles",
    }),
  ).toBe("/")
})
