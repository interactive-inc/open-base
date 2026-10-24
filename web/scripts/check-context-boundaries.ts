import { Glob } from "bun"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import process from "node:process"
import ts from "typescript"
import { z } from "zod"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const SOURCE_ROOT = resolve(PROJECT_ROOT, "src")
const API_ROOT = resolve(SOURCE_ROOT, "api")
const CONTEXTS_ROOT = resolve(SOURCE_ROOT, "contexts")
const LIB_ROOT = resolve(SOURCE_ROOT, "lib")
const OWNERSHIP_MANIFEST_PATH = resolve(PROJECT_ROOT, "context-ownership.json")
const RETIRED_CONTEXT_NAMES = new Set(["request"])

const CONTEXT_LAYERS = ["domain", "application", "infrastructure", "interface"] as const
const API_ROOT_DIRECTORIES = new Set(["error-response", "http", "routes", "scheduled"])
const API_ROOT_FILES = new Set([
  "api-route-module.ts",
  "app-base.ts",
  "app.ts",
  "database-middleware.ts",
  "route-module.registry.ts",
  "runtime-app.ts",
])
/**
 * src/lib直下で許可する技術責務。業務・System・Company・API compositionの語彙を持つ
 * ディレクトリは依存を持たない純粋関数でも所有者があるため、所有contextかAPI rootへ置く。
 */
const LIB_ROOT_DIRECTORIES = new Set([
  "config",
  "crypto",
  "d1",
  "database",
  "http",
  "text",
  "validation",
])
const LIB_ROOT_FILES = new Set(["errors.ts"])
const ownershipManifest = z
  .strictObject({
    companyAreasByLayer: z.strictObject({
      domain: z.array(z.string().min(1)),
      application: z.array(z.string().min(1)),
      infrastructure: z.array(z.string().min(1)),
      interface: z.array(z.string().min(1)),
    }),
    businessAreaOwners: z.record(z.string(), z.string().min(1)),
    routeOwners: z.record(z.string(), z.string().min(1)),
  })
  .parse(JSON.parse(readFileSync(OWNERSHIP_MANIFEST_PATH, "utf8")))

export type ContextLayer = (typeof CONTEXT_LAYERS)[number]

export type ContextSource = Readonly<{
  context: string
  layer: ContextLayer
}>

export type ContextBoundaryViolation = Readonly<{
  file: string
  reason: string
}>

function isTestFile(file: string): boolean {
  return /\.(?:test|spec)\.tsx?$/.test(file)
}

export function inspectContextLibraryContract(
  resourcePath: string,
  hasDocumentation: boolean,
  hasDirectTest: boolean,
): ContextBoundaryViolation[] {
  const violations: ContextBoundaryViolation[] = []

  if (!hasDocumentation) {
    violations.push({
      file: resourcePath,
      reason: "context直下のlibraryはAGENTS.mdに責務・対象外・公開入口・検証方法を記載してください",
    })
  }

  if (!hasDirectTest) {
    violations.push({
      file: resourcePath,
      reason: "context直下のlibraryはlibraryを直接実行するテストを少なくとも1つ置いてください",
    })
  }

  return violations
}

export function inspectContextRootLibrarySource(
  file: string,
  sourceText: string,
): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  if (!/^src\/contexts\/[^/]+\/lib\/[^/]+\//.test(normalized)) return []

  const violations: ContextBoundaryViolation[] = []
  const sourceFile = ts.createSourceFile(
    normalized,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    normalized.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    const moduleSpecifier = getModuleSpecifier(node)

    if (moduleSpecifier instanceof Error) {
      violations.push({ file, reason: moduleSpecifier.message })
    } else if (
      moduleSpecifier !== null &&
      (/^@\/contexts\/[^/]+\/(?:application|configuration|infrastructure|interface)(?:\/|$)/.test(
        moduleSpecifier,
      ) ||
        /^@system\/(?:application|configuration|infrastructure|interface)(?:\/|$)/.test(
          moduleSpecifier,
        ) ||
        /^(?:hono|drizzle-orm|xlsx|xlsx-js-style)(?:\/|$)/.test(moduleSpecifier) ||
        /^@\/(?:api|components|database)(?:\/|$)/.test(moduleSpecifier))
    ) {
      violations.push({
        file,
        reason: `context直下のlibraryからruntime実装へ依存しています: ${moduleSpecifier}`,
      })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

function containsDirectLibraryTest(directory: string): boolean {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory() && containsDirectLibraryTest(path)) return true
    if (entry.isFile() && isTestFile(entry.name)) return true
  }

  return false
}

function collectContextLibraryContractViolations(): ContextBoundaryViolation[] {
  const violations: ContextBoundaryViolation[] = []

  for (const contextEntry of readdirSync(CONTEXTS_ROOT, { withFileTypes: true })) {
    if (!contextEntry.isDirectory()) continue

    const libraryRoot = resolve(CONTEXTS_ROOT, contextEntry.name, "lib")
    if (!existsSync(libraryRoot)) continue

    for (const resourceEntry of readdirSync(libraryRoot, { withFileTypes: true })) {
      if (!resourceEntry.isDirectory()) continue

      const resourceDirectory = resolve(libraryRoot, resourceEntry.name)
      const resourcePath = relative(PROJECT_ROOT, resourceDirectory)
      violations.push(
        ...inspectContextLibraryContract(
          resourcePath,
          existsSync(resolve(resourceDirectory, "AGENTS.md")),
          containsDirectLibraryTest(resourceDirectory),
        ),
      )
    }
  }

  return violations
}

export function inspectSourceOrganization(
  file: string,
  sourceText: string,
): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const sourceFile = ts.createSourceFile(
    normalized,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    normalized.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const violations: ContextBoundaryViolation[] = []

  if (
    sourceFile.statements.some(
      (statement) => ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined,
    )
  ) {
    violations.push({ file, reason: "re-exportは禁止です。定義元を直接importしてください" })
  }

  if (isTestFile(normalized) || normalized.endsWith(".d.ts")) return violations

  if (/\/errors\//.test(normalized) || /(?:^|\/)[^/]+\.errors?\.tsx?$/.test(normalized)) {
    violations.push({
      file,
      reason: "Error定義はerrors/や*.error.tsへ分割せず、所有単位のerrors.tsへまとめてください",
    })
  }

  const definitions = sourceFile.statements.flatMap((statement) => {
    if (
      (ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name !== undefined &&
      /(?:Error|Exception)$/.test(statement.name.text)
    ) {
      return [statement.name.text]
    }

    return []
  })

  if (!normalized.endsWith("/errors.ts") && definitions.length > 0) {
    violations.push({
      file,
      reason: `失敗型とError classは所有単位のerrors.tsへまとめてください: ${definitions.join(", ")}`,
    })
  }

  return violations
}

/** Company直下をDDDの4層と横断testだけに限定し、互換directoryの残存を拒否する。 */
export function inspectCompanyRootPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/contexts\/company\/([^/]+)/)
  if (match === null) return []

  const rootDirectory = match[1]
  return rootDirectory !== undefined &&
    (isContextLayer(rootDirectory) ||
      rootDirectory === "configuration" ||
      rootDirectory === "lib" ||
      rootDirectory === "test")
    ? []
    : [{ file, reason: `Company直下のDDD layerではありません: ${rootDirectory ?? "unknown"}` }]
}

/** Company直下へ置ける領域をmanifestの明示リストへ限定する。 */
export function inspectCompanyAreaPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(
    /(?:^|\/)src\/contexts\/company\/(domain|application|infrastructure|interface)\/([^/]+)/,
  )
  if (match === null) return []

  const layer = match[1]
  const area = match[2]
  if (layer === undefined || area === undefined || !isContextLayer(layer)) return []

  if (area.endsWith(".ts")) return []

  return ownershipManifest.companyAreasByLayer[layer].includes(area)
    ? []
    : [{ file, reason: `Company ${layer} の許可領域ではありません: ${area}` }]
}

/** Company各層の許可領域を実ディレクトリと完全一致させる。 */
export function inspectCompanyAreaManifest(
  layer: ContextLayer,
  actualAreas: ReadonlyArray<string>,
): ContextBoundaryViolation[] {
  const declaredAreas = ownershipManifest.companyAreasByLayer[layer]
  const canonicalDeclaredAreas = [...new Set(declaredAreas)].toSorted()
  const canonicalActualAreas = [...new Set(actualAreas)].toSorted()
  const violations: ContextBoundaryViolation[] = []

  if (declaredAreas.some((area, index) => area !== canonicalDeclaredAreas[index])) {
    violations.push({
      file: "context-ownership.json",
      reason: `Company ${layer} の許可領域は重複なくpath昇順で宣言してください`,
    })
  }

  for (const area of canonicalActualAreas) {
    if (!canonicalDeclaredAreas.includes(area)) {
      violations.push({
        file: "context-ownership.json",
        reason: `Company ${layer} の実領域が未宣言です: ${area}`,
      })
    }
  }

  for (const area of canonicalDeclaredAreas) {
    if (!canonicalActualAreas.includes(area)) {
      violations.push({
        file: "context-ownership.json",
        reason: `Company ${layer} に存在しない許可領域です: ${area}`,
      })
    }
  }

  return violations
}

/** 単一context routeをmanifestで宣言した所有者の下へ固定する。 */
export function inspectRouteOwnershipPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(
    /(?:^|\/)src\/contexts\/([^/]+)\/interface\/routes\/([^/]+)(?:\/|$)/,
  )
  if (match === null) return []

  const actualOwner = match[1]
  const routeEntry = match[2]
  if (actualOwner === undefined || routeEntry === undefined) return []

  const routeBase = routeEntry.replace(/(?:\.test)?\.ts$/, "")
  const routePrefix = Object.keys(ownershipManifest.routeOwners)
    .filter((prefix) => routeBase === prefix || routeBase.startsWith(`${prefix}.`))
    .sort((left, right) => right.length - left.length)[0]
  if (routePrefix === undefined) return []

  const expectedOwner = ownershipManifest.routeOwners[routePrefix]
  return expectedOwner === undefined || expectedOwner === actualOwner
    ? []
    : [
        {
          file,
          reason: `route ${routePrefix} の所有者は ${expectedOwner} です: ${actualOwner}`,
        },
      ]
}

function hasFlatRoutePrefix(directory: string, routePrefix: string): boolean {
  if (!existsSync(directory)) return false

  return readdirSync(directory, { withFileTypes: true }).some(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      (entry.name === `${routePrefix}.ts` || entry.name.startsWith(`${routePrefix}.`)),
  )
}

/** manifestの所有contextとroute directoryが実在することを検査する。 */
export function inspectOwnershipManifest(): ContextBoundaryViolation[] {
  const violations: ContextBoundaryViolation[] = []
  const owners = new Set(Object.values(ownershipManifest.businessAreaOwners))

  for (const layer of CONTEXT_LAYERS) {
    const layerRoot = resolve(CONTEXTS_ROOT, "company", layer)
    const actualAreas = readdirSync(layerRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    violations.push(...inspectCompanyAreaManifest(layer, actualAreas))
  }

  for (const owner of owners) {
    if (!existsSync(resolve(CONTEXTS_ROOT, owner))) {
      violations.push({
        file: "context-ownership.json",
        reason: `business area の所有contextが存在しません: ${owner}`,
      })
    }
  }

  for (const [routePrefix, owner] of Object.entries(ownershipManifest.routeOwners)) {
    if (!hasFlatRoutePrefix(resolve(CONTEXTS_ROOT, owner, "interface", "routes"), routePrefix)) {
      violations.push({
        file: "context-ownership.json",
        reason: `route所有fileが存在しません: ${owner}/${routePrefix}`,
      })
    }
  }

  return violations
}

/** API rootをHTTP・定期起動のruntimeと、明示されたcontext横断compositionだけに限定する。 */
export function inspectApiRootPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/api\/(.+)$/)

  if (match === null) return []

  const relativePath = match[1]
  if (relativePath === undefined) return []

  const segments = relativePath.split("/")
  const rootEntry = segments[0]

  if (segments.length === 1) {
    return rootEntry !== undefined && API_ROOT_FILES.has(rootEntry)
      ? []
      : [{ file, reason: `API root直下に配置できないファイルです: ${relativePath}` }]
  }

  if (rootEntry === undefined || !API_ROOT_DIRECTORIES.has(rootEntry)) {
    return [{ file, reason: `API rootの責務外ディレクトリです: ${rootEntry ?? relativePath}` }]
  }

  const dddLayer = segments
    .slice(1, -1)
    .find((segment) => CONTEXT_LAYERS.some((layer) => layer === segment))

  return dddLayer === undefined
    ? []
    : [
        {
          file,
          reason: `API rootにDDD layer ${dddLayer} を作らず、所有contextへ配置してください`,
        },
      ]
}

/** 所有者を隠すcomposition・platform rootの再導入を拒否する。 */
export function inspectDisallowedRuntimeRootPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/(composition|platform)(?:\/|$)/)

  return match === null
    ? []
    : [
        {
          file,
          reason: `${match[1]} rootではなくAPI root、所有context、または中立libへ配置してください`,
        },
      ]
}

/** context横断テストの配置を単数形testへ統一する。 */
export function inspectContextTestDirectory(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")

  return /(?:^|\/)src\/contexts\/[^/]+\/tests(?:\/|$)/.test(normalized)
    ? [
        {
          file,
          reason: "context横断テストは複数形 tests ではなく単数形 test に配置してください",
        },
      ]
    : []
}

/** Systemへ吸収した汎用概念を独立contextとして再導入させない。 */
export function inspectRetiredContextPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/contexts\/([^/]+)(?:\/|$)/)
  const contextName = match?.[1]

  return contextName !== undefined &&
    (RETIRED_CONTEXT_NAMES.has(contextName) || contextName.endsWith("-compatibility"))
    ? [
        {
          file,
          reason: `${contextName} contextは廃止済みです。汎用手続はSystem、資格はCompany、業務payloadは所有contextへ配置してください`,
        },
      ]
    : []
}

function isContextLayer(value: string): value is ContextLayer {
  return CONTEXT_LAYERS.some((layer) => layer === value)
}

export function inspectRetiredLayerFirstRootPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  return /(?:^|\/)src\/(?:api\/)?(?:domain|application|infrastructure|interface)(?:\/|$)/.test(
    normalized,
  )
    ? [{ file, reason: "撤去済みの layer-first root を再作成しないでください" }]
    : []
}

/** context-first source の所有情報を読む。 */
export function classifyContextSource(file: string): ContextSource | null {
  const normalized = file.replaceAll("\\", "/")
  const contextFirst = normalized.match(
    /(?:^|\/)src\/contexts\/([^/]+)\/(domain|application|infrastructure|interface)(?:\/|$)/,
  )

  if (contextFirst === null) return null

  const context = contextFirst[1]
  const layer = contextFirst[2]

  return context !== undefined && layer !== undefined && isContextLayer(layer)
    ? { context, layer }
    : null
}

/** module aliasを、参照先contextとlayerへ正規化する。 */
export function classifyContextModule(moduleSpecifier: string): ContextSource | null {
  const systemReference = moduleSpecifier.match(
    /^@system\/(domain|application|infrastructure|interface)\//,
  )

  if (systemReference !== null) {
    const layer = systemReference[1]

    return layer !== undefined && isContextLayer(layer) ? { context: "system", layer } : null
  }

  const contextFirst = moduleSpecifier.match(
    /^@\/contexts\/([^/]+)\/(domain|application|infrastructure|interface)(?:\/|$)/,
  )

  if (contextFirst === null) return null

  const context = contextFirst[1]
  const layer = contextFirst[2]

  return context !== undefined && layer !== undefined && isContextLayer(layer)
    ? { context, layer }
    : null
}

/** System > Company > 業務の一方向依存だけを許可する。 */
export function canContextDependOn(sourceContext: string, targetContext: string): boolean {
  if (sourceContext === targetContext) return true
  if (sourceContext === "system") return false
  if (sourceContext === "company") return targetContext === "system"

  return targetContext === "system" || targetContext === "company"
}

function getModuleSpecifier(node: ts.Node): string | null | Error {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const moduleSpecifier = node.moduleSpecifier

    return moduleSpecifier !== undefined && ts.isStringLiteralLike(moduleSpecifier)
      ? moduleSpecifier.text
      : null
  }

  if (ts.isImportEqualsDeclaration(node)) {
    const reference = node.moduleReference

    return ts.isExternalModuleReference(reference) &&
      reference.expression !== undefined &&
      ts.isStringLiteralLike(reference.expression)
      ? reference.expression.text
      : null
  }

  if (ts.isImportTypeNode(node)) {
    return ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)
      ? node.argument.literal.text
      : new Error("型 import 先を静的に確認できません")
  }

  if (!ts.isCallExpression(node)) return null

  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require"

  if (!isDynamicImport && !isRequire) return null

  const argument = node.arguments[0]

  return argument !== undefined && ts.isStringLiteralLike(argument)
    ? argument.text
    : new Error("動的依存先を静的に確認できません")
}

/** 業務と API composition は Company の公開面だけを使い、内部実装を直接呼ばない。 */
export function inspectCompanyInternalDependency(
  file: string,
  moduleSpecifier: string,
): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  if (/(?:^|\/)src\/contexts\/company\//.test(normalized)) return []
  if (/(?:^|\/)test\//.test(normalized) || /\.test-support\.tsx?$/.test(normalized)) return []

  // domain の entity は Company の不変条件を持つ実体で、公開 operation の型としてだけ受け取る。
  const internal = moduleSpecifier.match(
    /^@\/contexts\/company\/(application|infrastructure|lib|domain\/entities)(?:\/|$)/,
  )
  if (internal === null) return []

  // 業務の table 定義は Company の table への外部キーだけを参照してよい。
  if (
    moduleSpecifier.startsWith("@/contexts/company/infrastructure/schema/") &&
    /\/infrastructure\/schema\//.test(normalized)
  ) {
    return []
  }

  return [
    {
      file,
      reason: `Company の内部実装へ依存しています。interface/operations の公開 operation を使ってください: ${moduleSpecifier}`,
    },
  ]
}

function inspectModuleDependency(
  file: string,
  source: ContextSource,
  moduleSpecifier: string,
): ContextBoundaryViolation[] {
  if (moduleSpecifier.startsWith("./") || moduleSpecifier.startsWith("../")) {
    return [{ file, reason: "context境界を迂回する相対 import があります" }]
  }

  if (
    /^@\/(?:api\/)?(?:domain|application|infrastructure|interface)(?:\/|$)/.test(moduleSpecifier)
  ) {
    return [{ file, reason: `撤去済みの layer-first path へ依存しています: ${moduleSpecifier}` }]
  }

  const companyInternal = inspectCompanyInternalDependency(file, moduleSpecifier)
  if (companyInternal.length > 0) return companyInternal

  const target = classifyContextModule(moduleSpecifier)

  if (target !== null) {
    return canContextDependOn(source.context, target.context)
      ? []
      : [
          {
            file,
            reason: `${source.context} から ${target.context} context へ依存しています: ${moduleSpecifier}`,
          },
        ]
  }

  if (moduleSpecifier === "@/schema" || moduleSpecifier.startsWith("@/schema/")) {
    return [{ file, reason: `context外の schema へ依存しています: ${moduleSpecifier}` }]
  }

  if (moduleSpecifier === "@/api" || moduleSpecifier.startsWith("@/api/")) {
    if (source.layer === "interface" && moduleSpecifier.startsWith("@/api/http/")) {
      return []
    }
    return [{ file, reason: `contextから API root へ依存しています: ${moduleSpecifier}` }]
  }

  if (
    moduleSpecifier === "@/interface/routes" ||
    moduleSpecifier.startsWith("@/interface/routes/")
  ) {
    return [{ file, reason: `context外の route composition へ依存しています: ${moduleSpecifier}` }]
  }

  return []
}

/** 相対指定子を `@/` 形式へ揃え、相対 import による検査の迂回を防ぐ。 */
function toProjectAlias(file: string, moduleSpecifier: string): string {
  if (!moduleSpecifier.startsWith("./") && !moduleSpecifier.startsWith("../")) {
    return moduleSpecifier
  }
  const target = relative(SOURCE_ROOT, resolve(PROJECT_ROOT, dirname(file), moduleSpecifier))
  return target.startsWith("..") ? moduleSpecifier : `@/${target.replaceAll("\\", "/")}`
}

/** API composition root も Company の内部実装へ直接依存させない。 */
export function inspectApiRootCompanyDependencies(
  file: string,
  sourceText: string,
): ContextBoundaryViolation[] {
  const violations: ContextBoundaryViolation[] = []
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    const moduleSpecifier = getModuleSpecifier(node)
    if (typeof moduleSpecifier === "string") {
      violations.push(
        ...inspectCompanyInternalDependency(file, toProjectAlias(file, moduleSpecifier)),
      )
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

/** context sourceのimport/export/type import/動的依存を同じ規則で検査する。 */
export function inspectContextSource(file: string, sourceText: string): ContextBoundaryViolation[] {
  const contextSource = classifyContextSource(file)
  if (contextSource === null) return []
  const ownedSource: ContextSource = contextSource

  const violations: ContextBoundaryViolation[] = []
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    const moduleSpecifier = getModuleSpecifier(node)

    if (moduleSpecifier instanceof Error) {
      violations.push({ file, reason: moduleSpecifier.message })
    } else if (moduleSpecifier !== null) {
      violations.push(...inspectModuleDependency(file, ownedSource, moduleSpecifier))
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

/** src/libにcontext・API・DBの所有責務が流入していないか検査する。 */
export function inspectLibSource(file: string, sourceText: string): ContextBoundaryViolation[] {
  const violations: ContextBoundaryViolation[] = []
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node): void {
    const moduleSpecifier = getModuleSpecifier(node)

    if (moduleSpecifier instanceof Error) {
      violations.push({ file, reason: moduleSpecifier.message })
    } else if (
      moduleSpecifier !== null &&
      (classifyContextModule(moduleSpecifier) !== null ||
        moduleSpecifier === "@/schema" ||
        moduleSpecifier.startsWith("@/schema/") ||
        moduleSpecifier === "@/api" ||
        moduleSpecifier.startsWith("@/api/"))
    ) {
      violations.push({
        file,
        reason: `lib から所有者のある実装へ依存しています: ${moduleSpecifier}`,
      })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

/** src/libの配置を技術責務のallowlistへ限定し、所有者のあるディレクトリの再導入を拒否する。 */
export function inspectLibPath(file: string): ContextBoundaryViolation[] {
  const normalized = file.replaceAll("\\", "/")
  const match = normalized.match(/(?:^|\/)src\/lib\/(.+)$/)

  if (match === null) return []

  const relativePath = match[1]
  if (relativePath === undefined) return []

  const segments = relativePath.split("/")
  const rootEntry = segments[0]

  if (segments.length === 1) {
    return rootEntry !== undefined && LIB_ROOT_FILES.has(rootEntry)
      ? []
      : [
          {
            file,
            reason: `lib直下に配置できないファイルです。所有contextかAPI rootへ置いてください: ${relativePath}`,
          },
        ]
  }

  return rootEntry !== undefined && LIB_ROOT_DIRECTORIES.has(rootEntry)
    ? []
    : [
        {
          file,
          reason: `lib の技術責務外ディレクトリです。所有contextかAPI rootへ置いてください: ${rootEntry ?? relativePath}`,
        },
      ]
}

/** 移行済みのcontext-first sourceと中立libを自動検査する。 */
export async function collectContextBoundaryViolations(): Promise<ContextBoundaryViolation[]> {
  const violations: ContextBoundaryViolation[] = [...inspectOwnershipManifest()]

  for await (const file of new Glob("**/*.{ts,tsx}").scan(SOURCE_ROOT)) {
    const path = resolve(SOURCE_ROOT, file)
    violations.push(
      ...inspectSourceOrganization(relative(PROJECT_ROOT, path), readFileSync(path, "utf8")),
    )
  }

  for (const rootName of ["domain", "application", "infrastructure", "interface"]) {
    for (const root of [resolve(SOURCE_ROOT, rootName), resolve(SOURCE_ROOT, "api", rootName)]) {
      if (existsSync(root)) {
        violations.push(...inspectRetiredLayerFirstRootPath(relative(PROJECT_ROOT, root)))
      }
    }
  }

  if (existsSync(API_ROOT)) {
    for await (const file of new Glob("**/*.{ts,tsx}").scan(API_ROOT)) {
      const path = resolve(API_ROOT, file)
      violations.push(...inspectApiRootPath(relative(PROJECT_ROOT, path)))
      if (isTestFile(file)) continue
      violations.push(
        ...inspectApiRootCompanyDependencies(
          relative(PROJECT_ROOT, path),
          readFileSync(path, "utf8"),
        ),
      )
    }
  }

  for (const disallowedRootName of ["composition", "platform"]) {
    const disallowedRoot = resolve(SOURCE_ROOT, disallowedRootName)
    if (!existsSync(disallowedRoot)) continue

    for await (const file of new Glob("**/*.{ts,tsx}").scan(disallowedRoot)) {
      violations.push(
        ...inspectDisallowedRuntimeRootPath(relative(PROJECT_ROOT, resolve(disallowedRoot, file))),
      )
    }
  }

  if (existsSync(CONTEXTS_ROOT)) {
    violations.push(...collectContextLibraryContractViolations())

    for await (const file of new Glob("**/*.{ts,tsx}").scan(CONTEXTS_ROOT)) {
      const path = resolve(CONTEXTS_ROOT, file)
      const projectRelativePath = relative(PROJECT_ROOT, path)

      violations.push(...inspectRetiredContextPath(projectRelativePath))
      violations.push(...inspectContextTestDirectory(projectRelativePath))
      violations.push(...inspectCompanyRootPath(projectRelativePath))
      violations.push(...inspectCompanyAreaPath(projectRelativePath))
      violations.push(...inspectRouteOwnershipPath(projectRelativePath))

      if (/\.(?:test|spec)\.tsx?$/.test(file)) continue

      violations.push(
        ...inspectContextRootLibrarySource(projectRelativePath, readFileSync(path, "utf8")),
      )
      violations.push(...inspectContextSource(projectRelativePath, readFileSync(path, "utf8")))
    }
  }

  if (existsSync(LIB_ROOT)) {
    for await (const file of new Glob("**/*.{ts,tsx}").scan(LIB_ROOT)) {
      const path = resolve(LIB_ROOT, file)
      const projectRelativePath = relative(PROJECT_ROOT, path)

      violations.push(...inspectLibPath(projectRelativePath))
      violations.push(...inspectLibSource(projectRelativePath, readFileSync(path, "utf8")))
    }
  }

  return violations
}

export async function checkContextBoundaries(): Promise<ReadonlyArray<ContextBoundaryViolation>> {
  return collectContextBoundaryViolations()
}

if (import.meta.main) {
  const violations = await checkContextBoundaries()

  if (violations.length > 0) {
    for (const violation of violations) console.error(`${violation.file}: ${violation.reason}`)
    process.exit(1)
  }

  console.log("context-first の依存境界を確認しました")
}
