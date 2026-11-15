import { help } from "@/app/accounts/route"
import { createCliFixtures } from "@/tests/support/create-cli-fixtures"
import { describeApiCommands, STEP_UP_TOKEN } from "@/tests/support/describe-api-commands"

const fixtures = createCliFixtures("accounts")
const account = crypto.randomUUID()
const identity = crypto.randomUUID()
const binding = crypto.randomUUID()
const status = fixtures.writeJson("status.json", { status: "suspended" })
const passkeyIdentity = fixtures.writeJson("identity.json", {
  provider: "passkey",
  email: "you@example.com",
})
const roleBinding = fixtures.writeJson("binding.json", { role_id: "viewer", resource: null })
const link = { reason: "対応を確認した", resources: [{ type: "account-employee-link" }] }
const linkFile = fixtures.writeJson("link.json", {
  organizationId: "org-1",
  expectedRevision: 4,
  ...link,
})
const stepUp = ["--step-up", STEP_UP_TOKEN]
const stepUpHeader = { "x-system-step-up": STEP_UP_TOKEN }

describeApiCommands({
  group: "accounts",
  help,
  cases: [
    { name: "list", argv: ["accounts"], expected: { method: "GET", path: "/system/accounts" } },
    {
      name: "show",
      argv: ["accounts", "show", account],
      expected: { method: "GET", path: `/system/accounts/${account}` },
    },
    {
      name: "create",
      argv: ["accounts", "create", ...stepUp],
      expected: { method: "POST", path: "/system/accounts", headers: stepUpHeader },
    },
    {
      name: "update",
      argv: ["accounts", "update", account, "--data", status, ...stepUp],
      expected: {
        method: "PATCH",
        path: `/system/accounts/${account}`,
        headers: stepUpHeader,
        body: { status: "suspended" },
      },
    },
    {
      name: "identities list",
      argv: ["accounts", "identities", "list", account],
      expected: { method: "GET", path: `/system/accounts/${account}/identities` },
    },
    {
      name: "identities show",
      argv: ["accounts", "identities", "show", account, identity],
      expected: { method: "GET", path: `/system/accounts/${account}/identities/${identity}` },
    },
    {
      name: "identities create",
      argv: ["accounts", "identities", "create", account, "--data", passkeyIdentity, ...stepUp],
      expected: {
        method: "POST",
        path: `/system/accounts/${account}/identities`,
        headers: stepUpHeader,
        body: { provider: "passkey", email: "you@example.com" },
      },
    },
    {
      name: "identities delete",
      argv: ["accounts", "identities", "delete", account, identity, ...stepUp],
      expected: {
        method: "DELETE",
        path: `/system/accounts/${account}/identities/${identity}`,
        headers: stepUpHeader,
      },
    },
    {
      name: "passkey-enrollments create",
      argv: ["accounts", "passkey-enrollments", "create", account, ...stepUp],
      expected: {
        method: "POST",
        path: `/system/accounts/${account}/passkey-enrollments`,
        headers: stepUpHeader,
      },
    },
    {
      name: "role-bindings list",
      argv: ["accounts", "role-bindings", "list", account],
      expected: { method: "GET", path: `/system/accounts/${account}/role-bindings` },
    },
    {
      name: "role-bindings create",
      argv: ["accounts", "role-bindings", "create", account, "--data", roleBinding, ...stepUp],
      expected: {
        method: "POST",
        path: `/system/accounts/${account}/role-bindings`,
        headers: stepUpHeader,
        body: { role_id: "viewer", resource: null },
      },
    },
    {
      name: "role-bindings delete",
      argv: ["accounts", "role-bindings", "delete", account, binding, ...stepUp],
      expected: {
        method: "DELETE",
        path: `/system/accounts/${account}/role-bindings/${binding}`,
        headers: stepUpHeader,
      },
    },
    {
      name: "directory",
      argv: ["accounts", "directory", "--status", "active", "--limit", "10", "--offset", "20"],
      expected: {
        method: "GET",
        path: "/company/account-directory",
        query: { status: "active", limit: "10", offset: "20" },
      },
    },
    {
      name: "employee-links list",
      argv: [
        "accounts",
        "employee-links",
        "list",
        "--organization-id",
        "org-1",
        "--as-of",
        "2026-04-01",
      ],
      expected: {
        method: "GET",
        path: "/company/account-employee-links",
        query: { as_of: "2026-04-01" },
        headers: { "x-company-organization-id": "org-1" },
      },
    },
    {
      name: "employee-links save",
      argv: [
        "accounts",
        "employee-links",
        "save",
        "--data",
        linkFile,
        "--idempotency-key",
        "link-1",
      ],
      expected: {
        method: "POST",
        path: "/company/account-employee-links",
        headers: {
          "x-company-organization-id": "org-1",
          "if-match": "4",
          "idempotency-key": "link-1",
        },
        body: link,
      },
    },
  ],
  // 標準入力を読むため tests/lib/secret-stdin.test.ts で別processから確かめる。
  testedElsewhere: ["password set"],
})
