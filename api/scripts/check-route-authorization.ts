/**
 * 全ルートが認可の判断を経ていることを機械的に確かめる。
 *
 *   bun run lint:route-authorization
 *
 * ## なぜ「宣言」を要求するのか
 *
 * 認可の判断はルートファイルの中だけにあるとは限らない。実際には
 *
 * - ルート内の `session.hasPermission("...")` / `session.permissions.has("...")`
 * - `verifyAuditPermission` のような専用 middleware
 * - `session` を渡された application service の内部（`api/src/application/` の約 145 ファイル）
 * - `canReadLeaveOf` のような同居のスコープ判定ヘルパ
 * - 本人限定ルートで、権限ではなく `employeeId` を絞り込みに使う形
 *
 * の 5 通りに分かれている。したがって「ルートファイルに hasPermission があるか」を
 * grep する検査は成立しない。実測で誤検知が約 75% になり、誤検知を潰すために
 * 検査自体を無視する運用になる。ownership を service 側で見ている
 * `knowledge-articles/[id]` の PUT/DELETE が典型で、grep では穴に見えるが穴ではない。
 *
 * そこでこの検査は「どう守っているか」を推測せず、各 handler に宣言を要求する。
 * 新しいルートを足したら、その場で下記のいずれかを書かないと検査が落ちる。
 *
 * ## この検査が保証すること・しないこと
 *
 * 保証するのは「認可の方針を書き忘れていない」ことだけである。宣言が実態と
 * 合っているかは検査しない（`// @authorization permission` と書いて中身が素通しでも通る）。
 * つまりこれは棚卸しであって認可の強制ではない。実際の認可は各 handler と
 * application service のコードが担い、その正しさはレビューとテストで見る。
 * この区別を曖昧にすると「検査が緑だから安全」という誤った安心を生む。
 *
 * ## 宣言の書き方
 *
 * 各 `export const <METHOD>` の直前に 1 行置く。メソッドごとに書く
 * （同じファイルの GET と POST で方針が違うことがあるため。例: 一覧は全員閲覧可・
 * 登録は権限必須）。
 *
 *   // @authorization permission - 権限キーで判定する
 *   // @authorization service - session を application service に渡して判定する
 *   // @authorization owner - 本人のリソースに限定する（権限キーは使わない）
 *   // @authorization authenticated - ログインしていれば誰でも読める共有マスタ
 *   // @authorization public - 未認証で到達してよい（ログイン・bootstrap 等）
 *   // @authorization machine - 機械用のキーで認証する（ユーザー Bearer ではない）
 *
 * `authenticated` と `public` は「意図的に緩い」という表明なので、
 * 付けるときはレビューで理由を確認する。
 */
import { Glob } from "bun"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ROUTE_MODULE_REGISTRY } from "@/api/route-module.registry"

const SOURCE_ROOT = resolve(import.meta.dir, "../src")

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

/** 宣言として認める値。 */
export const AUTHORIZATION_KINDS = [
  "permission",
  "service",
  "owner",
  "authenticated",
  "public",
  "machine",
] as const

export type AuthorizationKind = (typeof AUTHORIZATION_KINDS)[number]

/** 未認証で到達してよい宣言。これらは verifyBearer が無くてよい。 */
const UNAUTHENTICATED_KINDS = new Set<AuthorizationKind>(["public", "machine"])

export type RouteViolation = {
  file: string
  method: string
  reason: string
}

export type MethodDeclaration = {
  method: string
  /** 宣言の値。宣言そのものが無ければ null。 */
  declared: string | null
  /** その handler の定義本体（次の export まで）。 */
  body: string
}

export function exportedMethods(source: string): string[] {
  return METHODS.filter((method) => new RegExp(`^export const ${method}\\b`, "m").test(source))
}

/**
 * `export const <METHOD>` ごとに、直前の宣言と handler 本体を切り出す。
 * 本体はその export から次の export（または末尾）までとし、
 * 認証 middleware の有無をファイル全体ではなく handler 単位で見られるようにする。
 * ファイル全体を見ると、認証付きの GET が隣の無防備な POST を隠してしまう。
 */
export function parseMethodDeclarations(source: string): MethodDeclaration[] {
  const exportPattern = /^export const (GET|POST|PUT|PATCH|DELETE)\b/gm
  const starts: { method: string; index: number }[] = []
  for (const match of source.matchAll(exportPattern)) {
    starts.push({ method: match[1] ?? "", index: match.index ?? 0 })
  }

  return starts.map((start, order) => {
    const end = starts[order + 1]?.index ?? source.length
    const body = source.slice(start.index, end)

    // 直前（この export と、ひとつ前の export の間）にある最後の宣言を拾う。
    const precedingFrom = order === 0 ? 0 : (starts[order - 1]?.index ?? 0)
    const preceding = source.slice(precedingFrom, start.index)
    const declarations = [...preceding.matchAll(/\/\/\s*@authorization\s+(\S+)/g)]
    const declared = declarations.at(-1)?.[1] ?? null

    return { method: start.method, declared, body }
  })
}

/** 1 ファイルを検査する。違反があれば理由を返す。 */
export function inspectRouteFile(
  file: string,
  source: string,
  globallyAuthenticated = false,
): RouteViolation[] {
  const declarations = parseMethodDeclarations(source)
  if (declarations.length === 0) return []

  const violations: RouteViolation[] = []

  for (const entry of declarations) {
    if (entry.declared === null) {
      violations.push({
        file,
        method: entry.method,
        reason:
          `認可の宣言がありません。export const ${entry.method} の直前に ` +
          `"// @authorization <${AUTHORIZATION_KINDS.join("|")}>" を追加してください。`,
      })
      continue
    }

    if (!AUTHORIZATION_KINDS.includes(entry.declared as AuthorizationKind)) {
      violations.push({
        file,
        method: entry.method,
        reason: `認可の宣言 "${entry.declared}" は未定義です。${AUTHORIZATION_KINDS.join(" / ")} のいずれかを使ってください。`,
      })
      continue
    }

    const kind = entry.declared as AuthorizationKind

    // middleware は createHandlers の引数として現れる。import 文やコメントの
    // 出現で通してしまわないよう、handler 本体の中だけを見る。
    const hasUserAuthentication =
      globallyAuthenticated ||
      /\bverifyBearer\b/.test(entry.body) ||
      /\bauthenticateSystemAccessToken\b/.test(entry.body) ||
      /\brequireSystemAuthentication\b/.test(entry.body)
    const hasMachineGuard =
      /\bverify[A-Z]\w*Key\b/.test(entry.body) ||
      /\bauthenticateSystemMachineAccessToken\b/.test(entry.body)

    if (kind === "machine" && !hasMachineGuard) {
      violations.push({
        file,
        method: entry.method,
        reason: `"@authorization machine" と宣言していますが、機械用認証middlewareがありません。`,
      })
      continue
    }

    if (!UNAUTHENTICATED_KINDS.has(kind) && !hasUserAuthentication) {
      violations.push({
        file,
        method: entry.method,
        reason: `"@authorization ${kind}" と宣言していますがユーザー認証を通っていません。認証を追加するか public / machine へ直してください。`,
      })
      continue
    }

    if (kind === "public" && hasUserAuthentication) {
      violations.push({
        file,
        method: entry.method,
        reason: `"@authorization public" と宣言していますがユーザー認証を通っています。宣言を見直してください。`,
      })
    }
  }

  return violations
}

type RouteFile = Readonly<{ file: string; absolutePath: string }>

export async function collectRouteFiles(): Promise<RouteFile[]> {
  const routeFiles: RouteFile[] = []

  for (const routeModule of ROUTE_MODULE_REGISTRY) {
    const routesRoot = resolve(SOURCE_ROOT, routeModule.routesDirectory)
    for await (const file of new Glob("**/*.ts").scan(routesRoot)) {
      if (file.endsWith(".test.ts")) continue
      routeFiles.push({
        file: `${routeModule.routesDirectory}/${file}`,
        absolutePath: `${routesRoot}/${file}`,
      })
    }
  }

  return routeFiles.sort((left, right) => left.file.localeCompare(right.file))
}

export async function checkRouteAuthorization(): Promise<{
  violations: RouteViolation[]
  summary: Map<AuthorizationKind, number>
  checked: number
}> {
  const violations: RouteViolation[] = []
  const summary = new Map<AuthorizationKind, number>()
  let checked = 0
  const appBase = readFileSync(resolve(SOURCE_ROOT, "api/app-base.ts"), "utf8")
  // この登録の実際の例外と認証はcompany.external-identity-imports.d1.test.tsが検証する。
  const companyHasGlobalBearer =
    /\.use\(\s*["']\/company\/\*["']\s*,\s*(?:verifyBearer|companyAuthenticationMiddleware)\s*\)/.test(
      appBase,
    )

  for (const routeFile of await collectRouteFiles()) {
    const source = readFileSync(routeFile.absolutePath, "utf8")
    const declarations = parseMethodDeclarations(source)
    if (declarations.length === 0) continue

    const globallyAuthenticated =
      companyHasGlobalBearer && routeFile.file.startsWith("contexts/company/interface/routes/")
    violations.push(...inspectRouteFile(routeFile.file, source, globallyAuthenticated))

    // 集計は handler 単位。ファイル単位だと GET と POST で方針が違う場合に数が合わない。
    for (const entry of declarations) {
      checked++
      if (entry.declared === null) continue
      if (!AUTHORIZATION_KINDS.includes(entry.declared as AuthorizationKind)) continue
      const kind = entry.declared as AuthorizationKind
      summary.set(kind, (summary.get(kind) ?? 0) + 1)
    }
  }

  return { violations, summary, checked }
}

if (import.meta.main) {
  const { violations, summary, checked } = await checkRouteAuthorization()

  if (violations.length > 0) {
    console.error(`認可の宣言に問題があります（${violations.length} 件 / ${checked} handler）\n`)
    for (const violation of violations) {
      console.error(`  ${violation.file} ${violation.method}`)
      console.error(`    ${violation.reason}`)
    }
    process.exit(1)
  }

  console.log(`認可の宣言を確認しました（${checked} handler）`)
  for (const kind of AUTHORIZATION_KINDS) {
    const count = summary.get(kind) ?? 0
    if (count > 0) console.log(`  ${kind}: ${count}`)
  }
}
