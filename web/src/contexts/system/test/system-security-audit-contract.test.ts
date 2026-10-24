import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const systemRoot = fileURLToPath(new URL("..", import.meta.url))
const catalogPath = "domain/catalogs/audit/system-audit-action.catalog.ts"

/** 認証・IAMの成功境界に監査を必須とするSystem table。 */
const securityTables = Object.freeze({
  system_accounts: "systemAccounts",
  system_bootstrap_state: "systemBootstrapState",
  system_browser_login_codes: "systemBrowserLoginCodes",
  system_iam_role_permissions: "systemIamRolePermissions",
  system_iam_roles: "systemIamRoles",
  system_identity_bindings: "systemIdentityBindings",
  system_machine_credentials: "systemMachineCredentials",
  system_password_credentials: "systemPasswordCredentials",
  system_password_reset_challenges: "systemPasswordResetChallenges",
  system_role_bindings: "systemRoleBindings",
  system_sessions: "systemSessions",
})

/** 文を実行せず返すだけの公開builder。呼び出し側が同じbatchへ監査を加える。 */
const callerAuditedStatementBuilders = Object.freeze([
  "interface/operations/prepare-system-password-account-registration.ts",
])

function productionSources(): ReadonlyArray<Readonly<{ path: string; source: string }>> {
  return [...new Glob("**/*.ts").scanSync(systemRoot)]
    .filter(
      (path) =>
        !path.endsWith(".test.ts") &&
        !path.endsWith(".test-support.ts") &&
        !path.startsWith("test/"),
    )
    .sort()
    .map((path) => ({ path, source: readFileSync(`${systemRoot}/${path}`, "utf8") }))
}

function writtenSecurityTables(source: string): ReadonlyArray<string> {
  return Object.entries(securityTables)
    .filter(
      ([table, identifier]) =>
        new RegExp(
          `\\b(?:INSERT(?:\\s+OR\\s+\\w+)?\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+${table}\\b`,
          "i",
        ).test(source) ||
        new RegExp(`\\.(?:insert|update|delete)\\(\\s*${identifier}\\s*\\)`).test(source),
    )
    .map(([table]) => table)
}

describe("System audit action catalog", () => {
  test("actionは一意で監査語彙の形式に従う", () => {
    const actions = Object.values(SYSTEM_AUDIT_ACTIONS)

    expect(new Set(actions).size).toBe(actions.length)
    for (const action of actions) {
      expect(action).toMatch(/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/u)
    }
  })

  test("System本体はaction文字列を直接書かずcatalogだけを参照する", () => {
    const actions = new Set<string>(Object.values(SYSTEM_AUDIT_ACTIONS))
    const violations = productionSources()
      .filter(({ path }) => path !== catalogPath)
      .flatMap(({ path, source }) =>
        source.split("\n").flatMap((line, index) => {
          const literals = [...line.matchAll(/["'`]([a-z][a-z0-9_.-]*)["'`]/gu)].map(
            (match) => match[1],
          )
          return literals.some((literal) => literal !== undefined && actions.has(literal)) ||
            /\baction:\s*`[^`]*\$\{/u.test(line) ||
            /\baction:\s*["'][a-z][a-z0-9_-]*\./u.test(line)
            ? [`${path}:${index + 1}`]
            : []
        }),
      )

    expect(violations).toEqual([])
  })
})

describe("System security table writes", () => {
  test("security tableへの書込は監査文と同じbatchで確定する", () => {
    const writers = productionSources().filter(
      ({ source }) => writtenSecurityTables(source).length > 0,
    )
    expect(writers.length).toBeGreaterThan(0)

    const violations = writers.flatMap(({ path, source }) => {
      if (callerAuditedStatementBuilders.includes(path)) {
        return /\.(?:batch|run|exec|execute)\(|\bawait\b/u.test(source)
          ? [`${path}: statement builder must not execute writes`]
          : []
      }
      const audited = /\.prepareAppend\(|\bauditStatements\b/u.test(source)
      const executesOutsideBatch = /\.(?:run|exec)\(/u.test(source)
      return [
        ...(audited ? [] : [`${path}: security write has no audit statement`]),
        ...(executesOutsideBatch ? [`${path}: security write executes outside a batch`] : []),
      ]
    })

    expect(violations).toEqual([])
  })

  test("caller監査のbuilderはsecurity tableを書く実在fileだけを列挙する", () => {
    const sources = new Map(productionSources().map(({ path, source }) => [path, source]))

    for (const path of callerAuditedStatementBuilders) {
      expect(writtenSecurityTables(sources.get(path) ?? "").length).toBeGreaterThan(0)
    }
  })
})
