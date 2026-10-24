import { Glob } from "bun"
import { basename, dirname, resolve } from "node:path"
import { z } from "zod"

const PROJECT_ROOT = resolve(import.meta.dir, "..")

const manifestSchema = z.strictObject({
  version: z.literal(2),
  groups: z.array(
    z.strictObject({
      routePrefix: z.string().regex(/^[a-z][a-z0-9.-]*$/),
      participants: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).min(2),
      routes: z.array(z.string().regex(/^[a-z][A-Za-z0-9.$-]*$/)).min(1),
      reason: z.string().min(1),
    }),
  ),
})

function routeBase(path: string): string {
  return basename(path).replace(/(?:\.test)?\.ts$/, "")
}

/** API rootを、明示した複数contextの永続的なHTTP compositionだけへ限定する。 */
export async function checkApiCompositionRoutes(
  projectRoot: string = PROJECT_ROOT,
): Promise<ReadonlyArray<string>> {
  const parsed = manifestSchema.safeParse(
    await Bun.file(resolve(projectRoot, "api-route-composition.manifest.json")).json(),
  )
  if (!parsed.success) return ["api-route-composition.manifest.json を解析できません"]

  const groups = parsed.data.groups
  const violations: string[] = []
  const prefixes = groups.map((group) => group.routePrefix)
  const routeOwners = new Map<string, (typeof groups)[number]>()
  if (new Set(prefixes).size !== prefixes.length) {
    violations.push("API composition groupのroutePrefixが重複しています")
  }
  if (prefixes.some((prefix, index) => prefix !== prefixes.toSorted()[index])) {
    violations.push("API composition groupはroutePrefix順で宣言してください")
  }

  for (const group of groups) {
    if (new Set(group.participants).size !== group.participants.length) {
      violations.push(`${group.routePrefix} のparticipantsが重複しています`)
    }
    if (
      group.participants.some(
        (participant, index) => participant !== group.participants.toSorted()[index],
      )
    ) {
      violations.push(`${group.routePrefix} のparticipantsは昇順で宣言してください`)
    }
    if (group.routes.some((route, index) => route !== group.routes.toSorted()[index])) {
      violations.push(`${group.routePrefix} のroutesは昇順で宣言してください`)
    }
    for (const route of group.routes) {
      if (route !== group.routePrefix && !route.startsWith(`${group.routePrefix}.`)) {
        violations.push(`${group.routePrefix} にprefix外のrouteがあります: ${route}`)
      }
      if (routeOwners.has(route)) {
        violations.push(`API composition routeが重複宣言されています: ${route}`)
      } else {
        routeOwners.set(route, group)
      }
    }
  }

  const productionPaths: string[] = []
  const testPaths: string[] = []
  for await (const path of new Glob("src/api/routes/**/*.ts").scan({
    cwd: projectRoot,
    onlyFiles: true,
  })) {
    if (dirname(path) !== "src/api/routes") {
      violations.push(`API composition routeはflatに配置してください: ${path}`)
    } else if (path.endsWith(".test.ts")) {
      testPaths.push(path)
    } else {
      productionPaths.push(path)
    }
  }

  for (const path of productionPaths) {
    const owner = routeOwners.get(routeBase(path))
    if (owner === undefined) {
      violations.push(`未宣言のAPI composition routeです: ${path}`)
      continue
    }

    const source = await Bun.file(resolve(projectRoot, path)).text()
    const importedContexts = new Set<string>()
    for (const match of source.matchAll(/from\s+["']@\/contexts\/([^/"']+)/g)) {
      if (match[1] !== undefined) importedContexts.add(match[1])
    }
    if (/from\s+["']@system\//.test(source)) importedContexts.add("system")
    const participants = new Set(owner.participants)
    for (const context of importedContexts) {
      if (!participants.has(context)) {
        violations.push(`${path} の未宣言participant importです: ${context}`)
      }
    }
    if (/\b(?:context|c)\.var\.database\b/.test(source)) {
      violations.push(`${path} がAPI routeからdatabaseへ直接アクセスしています`)
    }
    if (
      /from\s+["'](?:@\/contexts\/[^/]+\/infrastructure\/|@system\/infrastructure\/)/.test(source)
    ) {
      violations.push(`${path} がContext Infrastructureを直接importしています`)
    }
    if (/^\s*(?:export\s+)?(?:async\s+)?function\s|^\s*(?:export\s+)?class\s/m.test(source)) {
      violations.push(`${path} がroute handler以外の関数またはclassを定義しています`)
    }
  }

  const productionRouteSet = new Set(productionPaths.map(routeBase))
  for (const route of routeOwners.keys()) {
    if (!productionRouteSet.has(route)) {
      violations.push(`manifestに実装のないAPI composition routeがあります: ${route}`)
    }
  }

  const productionPathSet = new Set(productionPaths)
  for (const testPath of testPaths) {
    // ローカルD1で検証するtestは *.d1.test.ts とし、同じproduction routeへ対応させる。
    const productionPath = testPath.replace(/(?:\.d1)?\.test\.ts$/, ".ts")
    if (!productionPathSet.has(productionPath)) {
      violations.push(`production routeとbasenameが一致しないtestです: ${testPath}`)
    }
  }

  return violations
}

if (import.meta.main) {
  const violations = await checkApiCompositionRoutes()
  if (violations.length > 0) {
    console.error(violations.join("\n"))
    process.exit(1)
  }
  console.log("API rootは宣言済みの永続composition routeだけです")
}
