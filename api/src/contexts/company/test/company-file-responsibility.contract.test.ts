import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"
import ts from "typescript"

const contextDirectory = new URL("..", import.meta.url)
const contextsDirectory = new URL("../../", import.meta.url)
const productionFiles = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })]
  .filter((file) => !file.endsWith(".test.ts") && !file.startsWith("test/"))
  .sort()

describe("Company file responsibility contract", () => {
  test("全contextのApplicationを一ユースケース一クラスに保つ", () => {
    const files = [
      ...new Glob("*/application/**/*.ts").scanSync({ cwd: contextsDirectory.pathname }),
    ].filter(
      (file) =>
        !file.endsWith(".test.ts") &&
        !file.endsWith("/errors.ts") &&
        !file.endsWith("/application-error.ts") &&
        !file.includes("/lib/"),
    )
    const violations = files.flatMap((file) => {
      const source = readFileSync(new URL(file, contextsDirectory), "utf8")
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
      const declarations = sourceFile.statements.flatMap((statement) => {
        if (
          !ts.isClassDeclaration(statement) ||
          statement.name === undefined ||
          statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) !==
            true
        ) {
          return []
        }

        const operations = statement.members.filter(
          (member): member is ts.MethodDeclaration =>
            ts.isMethodDeclaration(member) &&
            member.modifiers?.some(
              (modifier) =>
                modifier.kind === ts.SyntaxKind.PrivateKeyword ||
                modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
                modifier.kind === ts.SyntaxKind.StaticKeyword,
            ) !== true,
        )
        const ambiguous =
          /^(?:Write|Save|Upsert|Manage|Process|Handle|Advance|Decide|Transition)/.test(
            statement.name.text,
          )

        return [
          ...(operations.length > 1
            ? [`${file}: ${statement.name.text} has ${operations.length} public operations`]
            : []),
          ...(ambiguous ? [`${file}: ambiguous class ${statement.name.text}`] : []),
        ]
      })
      const applicationImports = sourceFile.statements.flatMap((statement) => {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteralLike(statement.moduleSpecifier)
        ) {
          return []
        }
        const imported = statement.moduleSpecifier.text
        return imported.includes("/application/") &&
          !imported.includes("/lib/") &&
          !imported.endsWith("/errors")
          ? [`${file}: Application import ${imported}`]
          : []
      })

      return [...declarations, ...applicationImports]
    })

    expect(violations).toEqual([])
  })

  test("全contextのrouteでユースケース選択に三項演算子を使わない", () => {
    const routeFiles = [
      ...new Glob("*/interface/routes/**/*.ts").scanSync({ cwd: contextsDirectory.pathname }),
    ].filter((file) => !file.endsWith(".test.ts"))
    const violations = routeFiles.filter((file) =>
      /\?\s*new\s+(?:Create|Update|Delete|Approve|Reject|Return|Submit|Publish|Activate|Archive|Hire|Open|Close)/.test(
        readFileSync(new URL(file, contextsDirectory), "utf8"),
      ),
    )

    expect(violations).toEqual([])
  })

  test("Infrastructureのproduction実装をrepositoriesとadaptersへ分離する", () => {
    const violations = productionFiles.filter(
      (file) =>
        file.startsWith("infrastructure/") &&
        !file.startsWith("infrastructure/schema/") &&
        !file.endsWith("/errors.ts") &&
        !file.includes("/lib/") &&
        !(file.startsWith("infrastructure/repositories/") && file.endsWith(".repository.ts")) &&
        !(file.startsWith("infrastructure/adapters/") && file.endsWith(".adapter.ts")),
    )

    expect(violations).toEqual([])
  })

  test("Applicationは操作を明示した一ユースケース一クラスにする", () => {
    const violations = productionFiles
      .filter((file) => file.startsWith("application/"))
      .flatMap((file) => {
        const source = readFileSync(new URL(file, contextDirectory), "utf8")
        return [
          ...(!/(?:^|\/)(?:apply|change|complete|correct|create|delete|end|hire|initialize|rehire|retire|return|start|transfer|update)-/.test(
            file,
          )
            ? [`${file}: concrete operation is not named`]
            : []),
          ...(source.match(/export class /g)?.length === 1
            ? []
            : [`${file}: use case must have exactly one exported class`]),
          ...(/export class (?:Write|Save|Upsert|Manage|Process|Handle|Advance|Decide|Transition)\w*/.test(
            source,
          )
            ? [`${file}: ambiguous use case class name`]
            : []),
          ...(!source.includes("/domain/") ? [`${file}: Domain model is not used`] : []),
        ]
      })

    expect(violations).toEqual([])
  })

  test("Applicationは別のApplicationを呼ばず公開操作を一つだけ持つ", () => {
    const violations = productionFiles
      .filter((file) => file.startsWith("application/"))
      .flatMap((file) => {
        const source = readFileSync(new URL(file, contextDirectory), "utf8")
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
        const classes = sourceFile.statements.filter(
          (statement): statement is ts.ClassDeclaration =>
            ts.isClassDeclaration(statement) &&
            statement.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
            ) === true,
        )
        const operations = classes.flatMap((classDeclaration) =>
          classDeclaration.members.filter(
            (member): member is ts.MethodDeclaration =>
              ts.isMethodDeclaration(member) &&
              member.modifiers?.some(
                (modifier) =>
                  modifier.kind === ts.SyntaxKind.PrivateKeyword ||
                  modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
                  modifier.kind === ts.SyntaxKind.StaticKeyword,
              ) !== true,
          ),
        )
        const applicationImports = sourceFile.statements.filter(
          (statement): statement is ts.ImportDeclaration =>
            ts.isImportDeclaration(statement) &&
            ts.isStringLiteralLike(statement.moduleSpecifier) &&
            statement.moduleSpecifier.text.includes("/application/") &&
            !statement.moduleSpecifier.text.endsWith("/application/errors"),
        )
        const selectsByKind = operations.some((operation) => {
          let found = false
          const visit = (node: ts.Node): void => {
            if (
              ts.isPropertyAccessExpression(node) &&
              node.name.text === "kind" &&
              node.expression.getText(sourceFile).includes("input")
            ) {
              found = true
            }
            ts.forEachChild(node, visit)
          }
          visit(operation)
          return found
        })

        return [
          ...(operations.length === 1
            ? []
            : [`${file}: public operation count is ${operations.length}`]),
          ...applicationImports.map(
            (statement) =>
              `${file}: Application import ${statement.moduleSpecifier.getText(sourceFile)}`,
          ),
          ...(selectsByKind ? [`${file}: public operation selects behavior by input.kind`] : []),
        ]
      })

    expect(violations).toEqual([])
  })

  test("Company resource routeは作成・更新・削除を別クラスからifで選ぶ", () => {
    const operations = [
      ["account-employee-links", "AccountEmployeeLinks"],
      ["definitions", "CompanyDefinitions"],
      ["employees", "Employees"],
      ["employments", "Employments"],
      ["people", "People"],
      ["profile", "CompanyProfile"],
    ] as const
    const violations = operations.flatMap(([route, subject]) => {
      const file = `interface/routes/company.${route}.ts`
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return [
        ...(!source.includes(`new Create${subject}`) ? [`${file}: Create${subject}`] : []),
        ...(!source.includes(`new Update${subject}`) ? [`${file}: Update${subject}`] : []),
        ...(!source.includes(`new Delete${subject}`) ? [`${file}: Delete${subject}`] : []),
        ...(!source.includes("if (") ? [`${file}: explicit if is required`] : []),
        ...(source.includes("? new ") ? [`${file}: ternary use case selection`] : []),
      ]
    })

    expect(violations).toEqual([])
  })

  test("route以外のproduction fileは公開実行操作を一つだけ持つ", () => {
    const violations = productionFiles.flatMap((file) => {
      if (file.startsWith("interface/routes/")) return []

      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      const operations =
        source.match(
          /^export (?:async )?function \w+|^export class (?!\w*Error\b)\w+|^export const \w+\s*=\s*(?:async\s*)?\(/gm,
        ) ?? []
      return operations.length > 1 ? [`${file}: ${operations.join(", ")}`] : []
    })

    expect(violations).toEqual([])
  })

  test("同一URLのmethodを一ファイルに置きschemaと変換をrouteへ閉じる", () => {
    const manifest = readFileSync(new URL("interface/route-manifest.ts", contextDirectory), "utf8")
    const pairedRoutes = [
      "account-employee-links",
      "definitions",
      "employees",
      "employments",
      "people",
      "profile",
    ]
    const violations = pairedRoutes.flatMap((route) => {
      const file = `interface/routes/company.${route}.ts`
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return [
        ...(!source.includes("export const GET") || !source.includes("export const POST")
          ? [`${file}: GET and POST must be colocated`]
          : []),
        ...(source.match(/zValidator\(/g)?.length === 4
          ? []
          : [`${file}: validators must be explicit`]),
        ...(source.includes("Schema") || source.includes("schema")
          ? [`${file}: shared HTTP schema import`]
          : []),
        ...(manifest.split(`module: "@/contexts/company/interface/routes/company.${route}"`)
          .length -
          1 ===
        2
          ? []
          : [`${file}: manifest does not use one module`]),
      ]
    })

    expect(violations).toEqual([])
  })

  test("薄いwrapperと汎用type再判定を再導入しない", () => {
    const forbidden = [
      "allowedTypes",
      "toCompanyResourceChange",
      "toCompanyReadQuery",
      "companyReadHeaderSchema",
      "companyReadQuerySchema",
      "companyWriteHeaderSchema",
      "createCompanyReadHandlers",
      "createCompanyWriteHandlers",
    ]
    const violations = productionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return forbidden.flatMap((token) => (source.includes(token) ? [`${file}: ${token}`] : []))
    })

    expect(violations).toEqual([])
  })

  test("Applicationへ永続化contractとgeneric HTTP factoryを再導入しない", () => {
    const violations = productionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return [
        ...(source.includes("export interface ") ? [`${file}: export interface`] : []),
        ...(file.startsWith("application/") &&
        /(?:^|\/)[^/]*(?:repository|persistence|gateway|port)(?:[.-]|$)/i.test(file)
          ? [`${file}: persistence contract file in Application`]
          : []),
        ...(file.startsWith("application/") &&
        /export (?:type|interface|class) \w*(?:Repository|Persistence|Gateway|Port|Reader|Writer)\b/.test(
          source,
        )
          ? [`${file}: persistence contract in Application`]
          : []),
        ...(source.includes("createCompanyReadHandlers") ||
        source.includes("createCompanyWriteHandlers") ||
        file.endsWith("company-resource-http.ts")
          ? [`${file}: generic Company HTTP factory`]
          : []),
      ]
    })

    expect(violations).toEqual([])
  })

  test("HTTP testはHono hc clientから呼び出す", () => {
    const files = [
      "test/company-api.integration.d1.test.ts",
      "interface/routes/company.capabilities.test.ts",
    ]
    const violations = files.flatMap((file) => {
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return source.includes('from "hono/client"') && !source.includes('request("/company/')
        ? []
        : [file]
    })

    expect(violations).toEqual([])
  })

  test("routeはURLをdotで表すflat fileだけを許可する", () => {
    const routeFiles = [...new Glob("interface/routes/**/*.ts").scanSync()]
    expect(routeFiles.filter((file) => file.split("/").length !== 3)).toEqual([])
    expect(
      routeFiles.filter((file) => /\/(?:route|create-route)(?:\.test)?\.ts$/.test(file)),
    ).toEqual([])
  })

  test("routeの失敗はHTTPException派生errorをthrowしResponseを直接生成しない", () => {
    const allowedThrownErrors = new Set([
      "CompanyHTTPException",
      "UnauthorizedError",
      "ForbiddenError",
      "NotFoundError",
      "ConflictError",
      "BadRequestError",
      "UnprocessableEntityError",
      "InternalError",
    ])
    const violations: string[] = []

    for (const file of productionFiles.filter((path) => path.startsWith("interface/routes/"))) {
      const sourceFile = ts.createSourceFile(
        file,
        readFileSync(new URL(file, contextDirectory), "utf8"),
        ts.ScriptTarget.Latest,
        true,
      )
      const lineOf = (node: ts.Node) =>
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      for (const statement of sourceFile.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteralLike(statement.moduleSpecifier) ||
          statement.moduleSpecifier.text !== "@/contexts/company/interface/errors" ||
          statement.importClause?.namedBindings === undefined ||
          !ts.isNamedImports(statement.importClause.namedBindings)
        ) {
          continue
        }
        for (const element of statement.importClause.namedBindings.elements) {
          allowedThrownErrors.add(element.name.text)
        }
      }
      const visit = (node: ts.Node): void => {
        if (ts.isThrowStatement(node)) {
          const expression = node.expression
          const constructorName =
            expression !== undefined &&
            ts.isNewExpression(expression) &&
            ts.isIdentifier(expression.expression)
              ? expression.expression.text
              : null
          const translatorName =
            expression !== undefined &&
            ts.isCallExpression(expression) &&
            ts.isIdentifier(expression.expression)
              ? expression.expression.text
              : null

          if (
            !allowedThrownErrors.has(constructorName ?? "") &&
            translatorName !== "toHttpException"
          ) {
            violations.push(`${file}:${lineOf(node)}: non-HTTP error throw`)
          }
        }

        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          (node.expression.name.text === "json" || node.expression.name.text === "body")
        ) {
          const status = node.arguments[1]
          if (status !== undefined) {
            const numbers: number[] = []
            const collectNumbers = (child: ts.Node): void => {
              if (ts.isNumericLiteral(child)) numbers.push(Number(child.text))
              ts.forEachChild(child, collectNumbers)
            }
            collectNumbers(status)

            if (numbers.length === 0 || numbers.some((value) => value >= 400)) {
              violations.push(`${file}:${lineOf(node)}: direct error response`)
            }
          }
        }

        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
    }

    expect(violations).toEqual([])
  })
})
