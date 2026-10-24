/**
 * src/api/app.ts と src/api/runtime-app.ts を明示登録された route source のディレクトリ構造から生成する。
 *
 *   bun run gen:app         # 生成して書き込む
 *   bun run gen:app --check # 生成結果と現在の生成物を比較する（差分があれば非ゼロ終了）
 *
 * app.ts は全route moduleを静的に import し、hc の型とテストの入口になる。
 * runtime-app.ts は Worker の入口が使う。同じ経路を同じ順序で登録するが、route module は
 * 要求された経路の分だけ動的 import で評価する。全moduleを評価すると isolate のメモリ上限を
 * 超え、isolate が要求ごとに作り直されて毎回全評価の CPU を払うため。
 *
 * 手動登録をやめる理由は、登録漏れ＝ルート消失が運用規約でしか防げていなかったこと。
 * route.ts を足したのに app.ts へ書き忘れると、実装は存在するのに API から到達できず、
 * テストも「そのルートを呼ばない」だけなので緑のまま通り抜ける。
 *
 * ## 対応づけの規則
 *
 * - registry内のroute sourceにある `export const GET|POST|PUT|PATCH|DELETE` を登録する
 * - `route.ts` / `<action>-route.ts` の URL はファイルを除いたディレクトリのパス
 * - それ以外の名前付きファイルはファイル名も URL の末尾に含める
 * - root直下のdot区切りrouteはdotをURLの`/`へ展開する
 *   (`company.capabilities.ts` -> `/company/capabilities`)
 * - `$param` は `:param` にする
 * - `*.test.ts` と、HTTP メソッドを export しない同居ヘルパは対象外
 * - middleware・エラーハンドラは手書きの `app-base.ts` が持つ。生成器は触らない
 *
 * 生成順は「同じメソッドで、同じセグメント数のとき、静的パスを動的パスより先に」出す。
 * Hono は同じ形の候補を登録順で解決するため、`/expenses/me` を `/expenses/:id` より
 * 後に登録すると `me` が id として食われる。この順序は規約ではなく生成器が保証する。
 */
import { Glob } from "bun"
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  inspectApiRouteModuleRegistry,
  type ApiRouteModuleRegistration,
} from "@/api/api-route-module"
import { ROUTE_MODULE_REGISTRY } from "@/api/route-module.registry"

const SOURCE_ROOT = resolve(import.meta.dir, "../src")
const APP_PATH = resolve(SOURCE_ROOT, "api/app.ts")
const RUNTIME_APP_PATH = resolve(SOURCE_ROOT, "api/runtime-app.ts")

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const ROUTES_PER_TYPE_PART = 48
const TYPE_HEAVY_ROUTE_PREFIXES = [
  "/company/application-requests",
  "/company/application-templates",
  "/company/approval-delegations",
  "/company/personnel-action-requests",
] as const
type Method = (typeof METHODS)[number]

export type RouteRegistration = {
  /** "@/interface/routes/employees/$code/route" */
  module: string
  /** "/employees/:code" */
  url: string
  method: Method
  /** app.ts 内でこのモジュールに与える import 別名 */
  alias: string
}

/** ルートファイルのパスから URL を作る。`$jobOpeningId` → `:jobOpeningId`。 */
export function toUrl(relativeFile: string): string {
  const segments = relativeFile.replace(/\.ts$/, "").split("/")
  const fileName = segments.at(-1) ?? ""
  const pathSegments =
    fileName === "route" || fileName.endsWith("-route") ? segments.slice(0, -1) : segments
  const mapped = pathSegments.flatMap((segment) =>
    segment.split(".").map((part) => (part.startsWith("$") ? `:${part.slice(1)}` : part)),
  )
  return `/${mapped.join("/")}`
}

/** context routeを必ず `/{context}/{resource}` へ置き、既にprefix済みなら重ねない。 */
export function toContextUrl(context: string, relativeFile: string): string {
  const route = toUrl(relativeFile)
  const prefix = `/${context}`
  return route === prefix || route.startsWith(`${prefix}/`) ? route : `${prefix}${route}`
}

/**
 * import 別名。パスから機械的に作る（手で付けた名前は再現できないし、再現する必要もない）。
 * `employees/$code/route.ts` → `employeesCodeRoute`
 * `application-requests/submit-route.ts` → `applicationRequestsSubmitRoute`
 *
 * `<動詞>-route.ts` は同じ URL に別メソッドを足す並置ファイルなので、ディレクトリだけでは
 * 隣の `route.ts` と別名が衝突する。動詞部分を名前に混ぜて区別する。
 */
export function toAlias(relativeFile: string): string {
  const path = relativeFile.replace(/\.ts$/, "")
  const segments = path.split("/")
  const fileName = segments.at(-1) ?? ""
  const directories = segments.slice(0, -1)
  // "submit-route" → "submit"、"route" → ""（ディレクトリ名だけで足りる）
  const verb = fileName === "route" ? "" : fileName.replace(/-route$/, "")
  const words = [...directories, verb].flatMap((segment) =>
    segment
      .replace(/\{[^}]*\}/g, "")
      .replaceAll("$", "")
      .split(/[.\-_]/)
      .filter(Boolean),
  )
  const camel = words
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("")
  return `${camel === "" ? "root" : camel}Route`
}

/** ルートファイルが export している HTTP メソッドを読む。 */
export function exportedMethods(source: string): Method[] {
  const found: Method[] = []
  for (const method of METHODS) {
    const pattern = new RegExp(`^export const ${method}\\b`, "m")
    if (pattern.test(source)) found.push(method)
  }
  return found
}

/** 明示registryを検査し、同じsourceの二重登録や消失をfail closedにする。 */
export function assertRouteModuleRegistry(
  routeModules: ReadonlyArray<ApiRouteModuleRegistration>,
): void {
  const violations = inspectApiRouteModuleRegistry(routeModules)
  if (violations.length > 0) throw new Error(violations.join("\n"))

  const routesDirectories = new Set<string>()

  for (const routeModule of routeModules) {
    const routesRoot = resolve(SOURCE_ROOT, routeModule.routesDirectory)
    if (!existsSync(routesRoot)) {
      throw new Error(`登録されたroutes directoryが存在しません: ${routeModule.routesDirectory}`)
    }

    routesDirectories.add(routeModule.routesDirectory)
  }

  const contextsRoot = resolve(SOURCE_ROOT, "contexts")
  const contextDirectories = readdirSync(contextsRoot, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  )
  for (const contextDirectory of contextDirectories) {
    const routesDirectory = `contexts/${contextDirectory.name}/interface/routes`
    if (!existsSync(resolve(SOURCE_ROOT, routesDirectory))) continue
    if (routesDirectories.has(routesDirectory)) continue

    throw new Error(`contextのroutes directoryが未登録です: ${routesDirectory}`)
  }
}

/** 明示登録されたroute sourceだけを走査して登録対象を集める。 */
export async function collectRegistrations(
  routeModules: ReadonlyArray<ApiRouteModuleRegistration> = ROUTE_MODULE_REGISTRY,
): Promise<RouteRegistration[]> {
  assertRouteModuleRegistry(routeModules)

  const registrations: RouteRegistration[] = []
  const seenAlias = new Map<string, string>()

  for (const routeModule of routeModules) {
    const routesRoot = resolve(SOURCE_ROOT, routeModule.routesDirectory)
    const files: string[] = []
    for await (const file of new Glob("**/*.ts").scan(routesRoot)) {
      if (file.endsWith(".test.ts")) continue
      files.push(file)
    }
    files.sort()

    for (const file of files) {
      const source = readFileSync(`${routesRoot}/${file}`, "utf8")
      const methods = exportedMethods(source)
      // HTTP メソッドを export しない同居ヘルパ（to-*.ts、can-read-*.ts 等）はここで落ちる。
      // ファイル名では判別できない（balance/route.ts は GET を持ち、
      // attendance-list-query.ts は持たない）ので export を見る。
      if (methods.length === 0) continue

      const alias = toAlias(file)
      const previous = seenAlias.get(alias)
      if (previous !== undefined) {
        throw new Error(
          `import 別名が衝突しました: ${alias}\n  ${previous}\n  ${file}\n` +
            "ディレクトリ名を変えて解消してください。",
        )
      }
      seenAlias.set(alias, file)

      const module = `${routeModule.routeImportPrefix}/${file.replace(/\.ts$/, "")}`
      const url =
        routeModule.tier === "composition" ? toUrl(file) : toContextUrl(routeModule.context, file)
      for (const method of methods) {
        registrations.push({ module, url, method, alias })
      }
    }
  }

  assertNoDuplicateRoutes(registrations)
  return registrations
}

/**
 * 動的セグメントの名前を伏せた形。`/a/:id` と `/a/:code` は Hono から見て同じ経路なので、
 * 重複判定はこの形で行う（URL 文字列そのままだと別物として通り抜ける）。
 */
export function toRouteShape(url: string): string {
  return url
    .split("/")
    .map((segment) => (segment.startsWith(":") ? ":" : segment))
    .join("/")
}

/**
 * 同じ (メソッド, 経路) が二重に生えていないか。Hono は黙って先勝ちするので落とす。
 * パラメータ名だけが違う `/a/:id` と `/a/:code` も重複として扱う。
 */
function assertNoDuplicateRoutes(registrations: readonly RouteRegistration[]): void {
  const seen = new Map<string, RouteRegistration>()
  for (const registration of registrations) {
    const key = `${registration.method} ${toRouteShape(registration.url)}`
    const previous = seen.get(key)
    if (previous !== undefined) {
      const detail =
        previous.url === registration.url
          ? key
          : `${key}（${previous.url} と ${registration.url}、パラメータ名が違うだけで同じ経路）`
      throw new Error(
        `ルートが重複しています: ${detail}\n  ${previous.module}\n  ${registration.module}\n` +
          "同じ URL に同じメソッドを二重に定義できません。",
      )
    }
    seen.set(key, registration)
  }
}

/** 動的パターン pattern が具体パス concrete を飲み込むか。 */
function covers(pattern: string, concrete: string): boolean {
  const patternSegments = pattern.split("/").filter(Boolean)
  const concreteSegments = concrete.split("/").filter(Boolean)
  if (patternSegments.length !== concreteSegments.length) return false
  return patternSegments.every(
    (segment, index) => segment.startsWith(":") || segment === concreteSegments[index],
  )
}

/**
 * 並べ替えの結果、先に登録されたパターンが後のルートを覆っていないかを確かめる。
 *
 * 比較器は「同じ位置で静的と動的が競合したら静的が先」までしか保証しない。
 * `/a/:x/:y` と `/a/:z/fixed` のように動的同士が先に食い違うと、比較は名前の
 * 辞書順に落ちるため、どちらが先に来るかは名前次第になる。この形は今のところ
 * 実在しないが、将来生えたときに黙って壊れないよう、生成時に検出して落とす。
 */
function assertNoShadowedRoutes(sorted: readonly RouteRegistration[]): void {
  for (const [index, registration] of sorted.entries()) {
    for (const earlier of sorted.slice(0, index)) {
      if (earlier.method !== registration.method) continue
      if (!earlier.url.includes(":")) continue
      if (earlier.url === registration.url) continue
      if (!covers(earlier.url, registration.url)) continue
      throw new Error(
        `ルートが覆い隠されています: ${registration.method} ${registration.url}\n` +
          `  先に登録される ${earlier.url} が飲み込みます。\n` +
          "  どちらかの URL を変えるか、登録順を明示してください。",
      )
    }
  }
}

/**
 * 静的パスを、それを覆いうる動的パスより先に置く。
 * 比較はセグメント単位で、静的（`:` で始まらない）を動的より先とする。
 *
 * 覆い隠しが起きないと言えるのは、**具体パスが完全に静的な場合に限る**。
 * 動的パターン D が静的パス S にマッチするとき、両者はセグメント数が等しく、
 * D が S と食い違う位置は必ず動的である（静的同士で食い違えばマッチしない）。
 * その最初の食い違い位置で比較器は「静的が先」を返すので、S は D より前に出る。
 *
 * 一方、動的同士（`/a/:x/:y` と `/a/:z/fixed`）が先に食い違う場合、比較は
 * パラメータ名の辞書順に落ちるため、順序は名前次第になり保証が無い。
 * この形は `assertNoShadowedRoutes` が生成時に検出して落とす。
 * 順序だけに頼らず、検査で担保している。
 */
export function sortRegistrations(
  registrations: readonly RouteRegistration[],
): RouteRegistration[] {
  return [...registrations].sort((left, right) => {
    const leftSegments = left.url.split("/").filter(Boolean)
    const rightSegments = right.url.split("/").filter(Boolean)
    const shared = Math.min(leftSegments.length, rightSegments.length)

    for (let index = 0; index < shared; index++) {
      const leftSegment = leftSegments[index] ?? ""
      const rightSegment = rightSegments[index] ?? ""
      if (leftSegment === rightSegment) continue
      const leftDynamic = leftSegment.startsWith(":")
      const rightDynamic = rightSegment.startsWith(":")
      // 同じ位置で静的と動的が競合したら、静的を先に登録する。
      if (leftDynamic !== rightDynamic) return leftDynamic ? 1 : -1
      return leftSegment < rightSegment ? -1 : 1
    }

    if (leftSegments.length !== rightSegments.length) {
      return leftSegments.length - rightSegments.length
    }
    return METHODS.indexOf(left.method) - METHODS.indexOf(right.method)
  })
}

/** 整形器の print width。これを超える登録行は整形器と同じ形にあらかじめ折る。 */
const LINE_WIDTH = 100

/**
 * 登録 1 行を描く。1 行に収まらないときは整形器（`vp check`）が作るのと同じ複数行の形で出す。
 * 生成結果がそのまま整形済みでないと、`bun run gen:app` の直後に `vp check` が落ちて、
 * 直すと今度は `gen:app:check` が落ちる、という行き場のない状態になる。
 */
export function renderRegistration(registration: RouteRegistration): string {
  const method = registration.method.toLowerCase()
  const handler = `...${registration.alias}.${registration.method}`
  const line = `  .${method}("${registration.url}", ${handler})`

  if (line.length <= LINE_WIDTH) {
    return line
  }

  return `  .${method}(\n    "${registration.url}",\n    ${handler},\n  )`
}

const HEADER = `// このファイルは \`bun run gen:app\` が生成する。手で編集しない。
// ルートを足すときは登録済みcontextのinterface/routesへ置き、生成器を再実行する。
// middleware・エラーハンドラは手書きの api/app-base.ts が持つ。
`

export function renderApp(registrations: readonly RouteRegistration[]): string {
  const sorted = sortRegistrations(registrations)
  assertNoShadowedRoutes(sorted)

  const modules = new Map<string, string>()
  for (const registration of sorted) {
    modules.set(registration.module, registration.alias)
  }
  const imports = [...modules.entries()]
    .sort((left, right) => (left[0] < right[0] ? -1 : 1))
    .map(([module, alias]) => `import * as ${alias} from "${module}"`)
    .join("\n")

  const routeParts: RouteRegistration[][] = []
  let currentPart: RouteRegistration[] = []
  const flushCurrentPart = () => {
    if (currentPart.length === 0) return
    routeParts.push(currentPart)
    currentPart = []
  }
  for (const registration of sorted) {
    const typeHeavy = TYPE_HEAVY_ROUTE_PREFIXES.some((prefix) =>
      registration.url.startsWith(prefix),
    )
    if (typeHeavy) {
      flushCurrentPart()
      routeParts.push([registration])
      continue
    }
    currentPart.push(registration)
    if (currentPart.length === ROUTES_PER_TYPE_PART) flushCurrentPart()
  }
  flushCurrentPart()
  const partDefinitions = routeParts.map((part, index) => renderRoutePart(part, index)).join("\n\n")
  const appChain = routeParts.map((_, index) => `  .route("/", routePart${index})`).join("\n")
  const clientPartTypes = routeParts
    .map(
      (_, index) => `type ApiClientPart${index} = ReturnType<typeof hc<typeof routePart${index}>>`,
    )
    .join("\n")
  const clientType = routeParts.map((_, index) => `ApiClientPart${index}`).join(" &\n  ")

  return `${HEADER}
import { hc } from "hono/client"
import { createAppBase, createRouteApp } from "@/api/app-base"
${imports}

${partDefinitions}

export const app = createAppBase()
${appChain}

export type AppType = typeof app

/**
 * routeを小さなHono appへ分割し、hc の型計算を再帰上限内で済ませた Client 型。
 * web/cli はこの型と AppType を type-only で import し、自前の hc<AppType>() に渡す。
 * 実行時に app 本体（全ルート）を消費側のバンドルへ引き込まないよう、ファクトリは置かない。
 */
${clientPartTypes}
export type ApiClient = ${clientType}
`
}

function renderRoutePart(part: readonly RouteRegistration[], index: number): string {
  const only = part.length === 1 ? part[0] : undefined
  if (only === undefined) {
    return `const routePart${index} = createRouteApp()\n${part.map(renderRegistration).join("\n")}`
  }

  const method = only.method.toLowerCase()
  const prefix = `const routePart${index} = createRouteApp().${method}(`
  const oneLine = `${prefix}"${only.url}", ...${only.alias}.${only.method})`
  if (oneLine.length <= 100) return oneLine

  return `${prefix}\n  "${only.url}",\n  ...${only.alias}.${only.method},\n)`
}

const RUNTIME_HEADER = `// このファイルは \`bun run gen:app\` が生成する。手で編集しない。
// app.ts と同じ経路を同じ順序で登録し、route module は要求された経路の分だけ読み込む。
// Worker の入口（src/index.ts）が使う。型と全route の静的検証は app.ts が担う。
`

function renderLoader(alias: string, module: string): string {
  const declaration = `const ${alias}: RouteModuleLoader =`
  const line = `${declaration} () => import("${module}")`
  if (line.length <= LINE_WIDTH) return line
  // 整形器と同じく、宣言と矢印が1行に収まらなければ矢印の前でも折る。
  if (`${declaration} () =>`.length <= LINE_WIDTH) {
    return `${declaration} () =>\n  import("${module}")`
  }
  return `${declaration}\n  () =>\n    import("${module}")`
}

function renderRuntimeRoute(registration: RouteRegistration): string {
  const line = `  ["${registration.method}", "${registration.url}", ${registration.alias}],`
  if (line.length <= LINE_WIDTH) return line
  return `  [\n    "${registration.method}",\n    "${registration.url}",\n    ${registration.alias},\n  ],`
}

export function renderRuntimeApp(registrations: readonly RouteRegistration[]): string {
  const sorted = sortRegistrations(registrations)
  assertNoShadowedRoutes(sorted)

  const modules = new Map<string, string>()
  for (const registration of sorted) {
    modules.set(registration.module, registration.alias)
  }
  const loaders = [...modules.entries()]
    .sort((left, right) => (left[0] < right[0] ? -1 : 1))
    .map(([module, alias]) => renderLoader(alias, module))
    .join("\n")

  return `${RUNTIME_HEADER}
import { createAppBase } from "@/api/app-base"
import {
  lazyRouteHandlers,
  type RouteMethod,
  type RouteModuleLoader,
} from "@/api/http/lazy-route-handlers"

${loaders}

const ROUTES: ReadonlyArray<readonly [RouteMethod, string, RouteModuleLoader]> = [
${sorted.map(renderRuntimeRoute).join("\n")}
]

export function createRuntimeApp() {
  const app = createAppBase()
  for (const [method, path, load] of ROUTES) {
    app.on(method, path, lazyRouteHandlers(load, method))
  }
  return app
}
`
}

// import されたとき（テスト等）に app.ts を書き換えないよう、実行はエントリ時に限る。
if (import.meta.main) {
  const registrations = await collectRegistrations()
  const outputs = [
    { path: APP_PATH, name: "app.ts", rendered: renderApp(registrations) },
    { path: RUNTIME_APP_PATH, name: "runtime-app.ts", rendered: renderRuntimeApp(registrations) },
  ]
  const checkOnly = process.argv.includes("--check")

  if (checkOnly) {
    const stale = outputs.filter(
      (output) => !existsSync(output.path) || readFileSync(output.path, "utf8") !== output.rendered,
    )
    if (stale.length > 0) {
      console.error(
        `${stale.map((output) => output.name).join(", ")} が interface/routes/ と一致していません。` +
          "`bun run gen:app` を実行してください。",
      )
      process.exit(1)
    }
    console.log(`app.ts と runtime-app.ts は最新です (${registrations.length} routes)`)
  } else {
    for (const output of outputs) writeFileSync(output.path, output.rendered)
    console.log(`app.ts と runtime-app.ts を生成しました (${registrations.length} routes)`)
  }
}
