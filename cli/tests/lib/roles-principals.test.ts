import { help as principalsHelp } from "@/app/principals/route"
import { help as rolesHelp } from "@/app/roles/route"
import { createCliFixtures } from "@/tests/support/create-cli-fixtures"
import { describeApiCommands, STEP_UP_TOKEN } from "@/tests/support/describe-api-commands"

const fixtures = createCliFixtures("roles")
const role = { name: "閲覧", description: null, permission_keys: ["iam:read"] }
const roleFile = fixtures.writeJson("role.json", role)
const principal = { kind: "agent", name: "Example agent" }
const principalFile = fixtures.writeJson("principal.json", principal)
const rename = { name: "Renamed agent", expected_revision: 2, reason: "名前を直す" }
const renameFile = fixtures.writeJson("rename.json", rename)
const credential = { name: "batch", expires_at: null, reason: "定期処理に使う" }
const credentialFile = fixtures.writeJson("credential.json", credential)
const revoke = { reason: "不要になった" }
const revokeFile = fixtures.writeJson("revoke.json", revoke)
const stepUp = ["--step-up", STEP_UP_TOKEN]
const stepUpHeader = { "x-system-step-up": STEP_UP_TOKEN }

describeApiCommands({
  group: "roles",
  help: rolesHelp,
  cases: [
    { name: "list", argv: ["roles"], expected: { method: "GET", path: "/system/roles" } },
    {
      name: "show",
      argv: ["roles", "show", "viewer"],
      expected: { method: "GET", path: "/system/roles/viewer" },
    },
    {
      name: "create",
      argv: ["roles", "create", "--data", roleFile, ...stepUp],
      expected: { method: "POST", path: "/system/roles", headers: stepUpHeader, body: role },
    },
    {
      name: "update",
      argv: ["roles", "update", "viewer", "--data", roleFile, ...stepUp],
      expected: {
        method: "PATCH",
        path: "/system/roles/viewer",
        headers: stepUpHeader,
        body: role,
      },
    },
    {
      name: "delete",
      argv: ["roles", "delete", "viewer", ...stepUp],
      expected: { method: "DELETE", path: "/system/roles/viewer", headers: stepUpHeader },
    },
    {
      name: "permission-definitions",
      argv: ["roles", "permission-definitions"],
      expected: { method: "GET", path: "/system/permission-definitions" },
    },
  ],
})

describeApiCommands({
  group: "principals",
  help: principalsHelp,
  cases: [
    {
      name: "list",
      argv: ["principals", "list"],
      expected: { method: "GET", path: "/system/principals" },
    },
    {
      name: "show",
      argv: ["principals", "show", "principal-1"],
      expected: { method: "GET", path: "/system/principals/principal-1" },
    },
    {
      name: "create",
      argv: ["principals", "create", "--data", principalFile, ...stepUp],
      expected: {
        method: "POST",
        path: "/system/principals",
        headers: stepUpHeader,
        body: principal,
      },
    },
    {
      name: "update",
      argv: ["principals", "update", "principal-1", "--data", renameFile, ...stepUp],
      expected: {
        method: "PATCH",
        path: "/system/principals/principal-1",
        headers: stepUpHeader,
        body: rename,
      },
    },
    {
      name: "machine-credentials list",
      argv: ["principals", "machine-credentials", "list", "principal-1"],
      expected: { method: "GET", path: "/system/principals/principal-1/machine-credentials" },
    },
    {
      name: "machine-credentials create",
      argv: [
        "principals",
        "machine-credentials",
        "create",
        "principal-1",
        "--data",
        credentialFile,
        ...stepUp,
      ],
      expected: {
        method: "POST",
        path: "/system/principals/principal-1/machine-credentials",
        headers: stepUpHeader,
        body: credential,
      },
    },
    {
      name: "machine-credentials delete",
      argv: [
        "principals",
        "machine-credentials",
        "delete",
        "principal-1",
        "credential-1",
        "--data",
        revokeFile,
        ...stepUp,
      ],
      expected: {
        method: "DELETE",
        path: "/system/principals/principal-1/machine-credentials/credential-1",
        headers: stepUpHeader,
        body: revoke,
      },
    },
  ],
})
