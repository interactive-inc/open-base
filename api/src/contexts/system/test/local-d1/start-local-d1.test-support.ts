import { splitSqlStatements } from "@system/test/local-d1/split-sql-statements.test-support"
import { Miniflare } from "miniflare"
import {
  installWorkerdStdioGuard,
  runningWorkerdPids,
  takeWorkerdStdioFailures,
} from "@system/test/local-d1/guard-workerd-stdio.test-support"
import {
  LOCAL_D1_WORKER_SCRIPT,
  createLocalD1FetchClient,
} from "@system/test/local-d1/local-d1-fetch-client.test-support"
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

export type LocalD1 = Readonly<{
  database: (name: string) => Promise<D1Database>
  /**
   * `from`の現在の内容を、まだ開いていない`to`へ複製する。D1の時点復元の模擬に使う。
   * 本番のTime Travelそのものではなく、複製した時点のSQLiteファイルを別のDBとして開くだけである。
   */
  snapshot: (from: string, to: string) => Promise<void>
  dispose: () => Promise<void>
}>

export type LocalD1Databases = Readonly<{
  /** migrationを適用していない空のDB。D1契約やmigration途中の検証に使う。 */
  empty?: ReadonlyArray<string>
  /** 全migration適用済みtemplateの独立した複製。Repository・SQL・HTTP入口の検証に使う。 */
  migrated?: ReadonlyArray<string>
  /**
   * `migrated`の内容を全migrationではなく、このSQLを空のDBへ適用した結果にする。
   * 大きな共通schemaを多数のDBで使うtestが、DBごとにschemaを再生しないために使う。
   */
  schema?: string
}>

type Template = Readonly<{
  directory: string
  file: string
  objectCount: number
  /** 複製先の database id ごとの、Miniflareが割り当てるSQLiteファイル名。 */
  slotFiles: ReadonlyArray<string>
}>

/** 各製品repositoryの配置差を吸収し、全migrationの正本を返す。 */
const projectRoot = join(import.meta.dir, "../../../../..")
const migrationsDirectory = existsSync(join(projectRoot, "migrations"))
  ? join(projectRoot, "migrations")
  : join(projectRoot, "drizzle")

installWorkerdStdioGuard()

/** Miniflareが D1 の Durable Object を永続化する、persist directory 内の相対位置。 */
const D1_OBJECT_DIRECTORY = join("d1", "miniflare-D1DatabaseObject")

const TEMPLATE_BINDING = "TEMPLATE"

/** 1ファイルで宣言できるmigration済みDBの上限。 */
const MIGRATED_SLOT_COUNT = 64

/**
 * 1つのworkerdに載せるmigration済みDBの枠数。複製先の database id を固定の枠にし、
 * そのSQLiteファイル名をtemplate作成時に一度だけ調べる。使い切ったらworkerdを作り直す。
 *
 * MiniflareはworkerdへDB数に比例する設定を標準入力で渡す。Bunはこの書込みを途中で
 * 止めることがあり、設定が大きいほど起動が止まりやすいため、1つのworkerdの枠は
 * 1ファイルの上限と同じ数に留める。
 */
const RUNTIME_MIGRATED_SLOT_COUNT = MIGRATED_SLOT_COUNT

/** 1つのworkerdに載せる空DBの枠数。 */
const RUNTIME_EMPTY_SLOT_COUNT = 32

let migrationStatements: ReadonlyArray<ReadonlyArray<string>> | null = null

/** 内容の種類（全migration、または特定のschema）ごとのtemplate。 */
const templates = new Map<string, Promise<Template>>()

let scratchRoot: string | null = null

/** プロセスで共有するworkerdと、まだ割り当てていない枠の位置。 */
type SharedRuntime = {
  runtime: Miniflare
  persist: string
  /** 起動したworkerdのpid。これが動いていなければ、以降のファイルには新しいworkerdを使う。 */
  pid: number | undefined
  nextMigrated: number
  nextEmpty: number
}

let shared: Promise<SharedRuntime> | null = null

/**
 * Cloudflare提供のローカルD1エミュレーター（Miniflare）を使う。本番D1そのものではない。
 * 宣言した名前ごとに、プロセスで共有するworkerd上の未使用の枠を割り当て、testの間でDBを共有しない。
 *
 * workerdはファイルごとに起動せず、枠を使い切るまでプロセスで1つを使い回す。
 * Bunは1プロセスで子プロセスの起動と停止を繰り返すと、pipeで EBADF や ENOENT を返して
 * workerdの起動が失敗または停止することがあるため。停止は全ファイルの後に`stopLocalD1`が行う。
 *
 * migration済みDBは、プロセスで一度だけ全migrationを適用したtemplateのSQLiteファイルを、
 * 各DBを最初に使う時にそのファイル位置へ複製して用意する。workerdはDBへ最初に触れた時に
 * ファイルを開くため、複製はその前に終わる。数百のmigrationをDBごとに再生しない。
 * 複製後はtemplateと同じschema object数かを検査し、Miniflareの保存形式が変わったら失敗させる。
 * DBへはMiniflareの同期proxyを使わず、SQLを実行するだけのWorkerへfetchで送る（local-d1-fetch-client.ts）。
 * Worker scriptは外向き通信を持たず、outboundも拒否する。
 */
export async function startLocalD1(databases: LocalD1Databases): Promise<LocalD1> {
  const empty = databases.empty ?? []
  const migrated = databases.migrated ?? []
  const names = [...empty, ...migrated]

  if (new Set(names).size !== names.length) {
    throw new Error("local D1 names must be distinct; give each test its own database")
  }

  if (migrated.length > MIGRATED_SLOT_COUNT) {
    throw new Error(`declare at most ${MIGRATED_SLOT_COUNT} migrated local D1 databases per file`)
  }

  if (empty.length > RUNTIME_EMPTY_SLOT_COUNT) {
    throw new Error(`declare at most ${RUNTIME_EMPTY_SLOT_COUNT} empty local D1 databases per file`)
  }

  const source = migrated.length > 0 ? await buildTemplate(databases.schema) : null
  const current = await reserve(migrated.length, empty.length)
  const firstMigrated = current.nextMigrated - migrated.length
  const firstEmpty = current.nextEmpty - empty.length
  const bindings = new Map<string, string>([
    ...empty.map((name, index): [string, string] => [name, emptyBindingFor(firstEmpty + index)]),
    ...migrated.map((name, index): [string, string] => [
      name,
      migratedBindingFor(firstMigrated + index),
    ]),
  ])
  const slotOf = new Map(migrated.map((name, index) => [name, firstMigrated + index]))
  const copied = new Set<string>()

  const slotPath = (slot: number): string => {
    const slotFile = source?.slotFiles[slot]
    if (slotFile === undefined) throw new Error(`local D1 slot ${slot} has no discovered file`)
    return join(current.persist, D1_OBJECT_DIRECTORY, slotFile)
  }

  return {
    database: async (name) => {
      const binding = bindings.get(name)
      if (binding === undefined) {
        throw new Error(`local D1 "${name}" was not declared in startLocalD1`)
      }
      const slot = slotOf.get(name)
      const first = source !== null && slot !== undefined && !copied.has(name)
      if (first) {
        copyDatabaseFile(join(source.directory, D1_OBJECT_DIRECTORY, source.file), slotPath(slot))
        copied.add(name)
      }
      const database = createLocalD1FetchClient(current.runtime, binding)
      if (first) await verifyCopy(name, database, source.objectCount)
      return database
    },
    snapshot: async (from, to) => {
      const source = slotOf.get(from)
      const target = slotOf.get(to)
      if (source === undefined || target === undefined) {
        throw new Error("local D1 snapshot needs two declared migrated databases")
      }
      if (!copied.has(from)) throw new Error(`local D1 "${from}" has not been opened`)
      if (copied.has(to)) throw new Error(`local D1 "${to}" is already open`)
      // 呼び出し側は要求を全て待ってから呼ぶ。進行中の書込みが無いため、本体とWALの組は一貫する。
      copyDatabaseFile(slotPath(source), slotPath(target))
      copied.add(to)
    },
    // 枠は再利用しないため共有のworkerdは止めず、このファイルが複製したDBファイルだけを消す。
    dispose: async () => {
      for (const name of copied) {
        const slot = slotOf.get(name)
        if (slot === undefined) continue
        for (const suffix of ["", "-wal", "-shm"]) {
          rmSync(`${slotPath(slot)}${suffix}`, { force: true })
        }
      }
    },
  }
}

/**
 * 共有workerdを止め、作業ディレクトリを消す。全testファイルの後に一度だけ呼ぶ。
 * bun test はプロセス終了時の exit イベントを待たないため、終了処理に頼らない。
 */
export async function stopLocalD1(): Promise<void> {
  const current = shared === null ? null : await shared.catch(() => null)
  shared = null
  if (current !== null) await current.runtime.dispose()
  if (scratchRoot !== null) {
    rmSync(scratchRoot, { recursive: true, force: true })
    scratchRoot = null
  }
  templates.clear()
}

/** 共有workerdから枠を確保する。足りなければworkerdを作り直す。 */
async function reserve(migrated: number, empty: number): Promise<SharedRuntime> {
  let current = shared === null ? null : await shared.catch(() => null)
  if (
    current === null ||
    // bun test は test がtimeoutすると動いている子プロセスを全て止める。止められたworkerdは
    // Miniflareが作り直すが、作り直す前の要求は届かないため、次のファイルからは新しいworkerdを使う。
    current.pid === undefined ||
    !runningWorkerdPids().includes(current.pid) ||
    !(await answers(current.runtime)) ||
    current.nextMigrated + migrated > RUNTIME_MIGRATED_SLOT_COUNT ||
    current.nextEmpty + empty > RUNTIME_EMPTY_SLOT_COUNT
  ) {
    const retired = current
    const next = (async () => {
      if (retired !== null) {
        await retired.runtime.dispose()
        rmSync(retired.persist, { recursive: true, force: true })
      }
      return createSharedRuntime()
    })()
    shared = next
    // 失敗した起動を再利用せず、次の呼び出しで作り直す。
    next.catch(() => {
      if (shared === next) shared = null
    })
    current = await next
  }
  current.nextMigrated += migrated
  current.nextEmpty += empty
  return current
}

/**
 * 共有workerdが要求に応えるかを確かめる。止められた直後はpidの記録より先に次のファイルが
 * 始まることがあるため、実際に要求を送って届かなければ使わない。
 */
async function answers(runtime: Miniflare): Promise<boolean> {
  return runtime.dispatchFetch("http://local-d1.invalid/", { method: "POST", body: "{}" }).then(
    async (response) => {
      await response.arrayBuffer()
      return true
    },
    () => false,
  )
}

async function createSharedRuntime(): Promise<SharedRuntime> {
  const bindings: Record<string, string> = {}
  for (let index = 0; index < RUNTIME_MIGRATED_SLOT_COUNT; index++) {
    bindings[migratedBindingFor(index)] = slotIdFor(index)
  }
  for (let index = 0; index < RUNTIME_EMPTY_SLOT_COUNT; index++) {
    bindings[emptyBindingFor(index)] = `local-d1-test-empty-slot-${index}`
  }
  const preparePersist = (): string => {
    const persist = join(scratchDirectory(), `run-${crypto.randomUUID()}`)
    mkdirSync(join(persist, D1_OBJECT_DIRECTORY), { recursive: true })
    return persist
  }
  const before = new Set(runningWorkerdPids())
  const { runtime, persist } = await startRuntime(preparePersist, {
    create: (directory) => createRuntime(directory, bindings),
  })
  // 起動を作り直した場合は、最後に起動したworkerdが使われる。
  const pid = runningWorkerdPids()
    .filter((candidate) => !before.has(candidate))
    .at(-1)
  return { runtime, persist, pid, nextMigrated: 0, nextEmpty: 0 }
}

function migratedBindingFor(index: number): string {
  return `MIGRATED_${index}`
}

function emptyBindingFor(index: number): string {
  return `EMPTY_${index}`
}

function slotIdFor(index: number): string {
  return `local-d1-test-migrated-slot-${index}`
}

/** workerd の起動が失敗した時、または止まった時に作り直す回数。 */
const RUNTIME_START_ATTEMPTS = 5

/**
 * 起動を作り直す前に待つ時間（試行ごと）。Bunは失敗した子プロセスのpipeを閉じ終えるまで、
 * 続けて起動した子プロセスでも同じ失敗を返すことがあるため、間隔を広げながら作り直す。
 */
const RUNTIME_RESTART_DELAYS_MS = [250, 1_000, 2_000, 4_000]

/** 起動が止まったと見なすまでの時間。通常の起動は1秒前後で終わる。 */
const RUNTIME_START_STALL_MS = 15_000

/** 起動を試す実行環境。Miniflareのうち、起動の待機と停止だけを使う。 */
export type StartableRuntime = Readonly<{
  ready: Promise<unknown>
  dispose: () => Promise<void>
}>

type StartRuntimeOptions<T extends StartableRuntime> = Readonly<{
  create: (persist: string) => T
  stallMs?: number
  attempts?: number
  restartDelaysMs?: ReadonlyArray<number>
}>

type Readiness = Readonly<{ kind: "ready" }> | Readonly<{ kind: "failed"; error: unknown }>

/**
 * 1プロセスで多数のファイルを流すと、Bunが workerd を起動する子プロセスのpipeで
 * EBADF や ENOENT を返し、起動が失敗するか、完了しないまま止まることがある。その場合に起動を作り直す。
 * 作り直しは毎回新しいディレクトリを使い、止まった起動のworkerdが後から動き出しても、
 * 同じDBファイルへ2つのworkerdを向けない。
 *
 * 各起動の`ready`は一度だけ観測し、結果を値に変えてから待つ。止まったと見なして作り直した後で
 * 元の起動が失敗しても、その失敗は作り直しの原因として記録され、未処理のrejectionにならない。
 * 後から起動が完了した場合は停止する。作り直しても起動しなければ最後の失敗を投げる。
 */
export async function startRuntime<T extends StartableRuntime>(
  preparePersist: () => string,
  options: StartRuntimeOptions<T>,
): Promise<{ runtime: T; persist: string }> {
  const stallMs = options.stallMs ?? RUNTIME_START_STALL_MS
  const attempts = options.attempts ?? RUNTIME_START_ATTEMPTS
  const restartDelaysMs = options.restartDelaysMs ?? RUNTIME_RESTART_DELAYS_MS
  for (let attempt = 1; ; attempt++) {
    const persist = preparePersist()
    const runtime = options.create(persist)
    const startedAt = performance.now()
    const readiness: Promise<Readiness> = runtime.ready.then(
      () => ({ kind: "ready" }),
      (error: unknown) => ({ kind: "failed", error }),
    )
    let timer: ReturnType<typeof setTimeout> | undefined
    const stalled = new Promise<"stalled">((resolve) => {
      timer = setTimeout(() => resolve("stalled"), stallMs)
    })
    const outcome = await Promise.race([readiness, stalled])
    clearTimeout(timer)
    if (outcome !== "stalled" && outcome.kind === "ready") return { runtime, persist }
    let failure: unknown
    if (outcome === "stalled") {
      failure = new Error(`local D1 runtime did not start within ${stallMs}ms`)
      abandon(runtime, readiness, attempt)
    } else {
      failure = outcome.error
      // 起動に失敗したMiniflareの停止は、同じ起動の失敗で終わる。別の失敗だけを記録する。
      await runtime.dispose().catch((error: unknown) => {
        if (error !== failure) {
          console.warn(`local D1 runtime of failed attempt ${attempt} did not stop cleanly:`, error)
        }
      })
      rmSync(persist, { recursive: true, force: true })
    }
    const elapsed = Math.round(performance.now() - startedAt)
    console.warn(
      `local D1 runtime failed to start after ${elapsed}ms (attempt ${attempt}):`,
      failure,
      ...takeWorkerdStdioFailures(),
    )
    if (attempt >= attempts) throw failure
    const delay = restartDelaysMs[Math.min(attempt - 1, restartDelaysMs.length - 1)] ?? 0
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

/**
 * 止まったと見なした起動を捨てる。停止は起動の完了を待つことがあるため待たずに進め、
 * 起動が後から終わった時の結果を記録する。失敗はすでに作り直しの原因として扱っている。
 */
function abandon(runtime: StartableRuntime, readiness: Promise<Readiness>, attempt: number): void {
  void readiness.then((late) => {
    if (late.kind === "failed") {
      console.warn(`local D1 runtime of abandoned attempt ${attempt} failed later:`, late.error)
    }
  })
  void runtime.dispose().catch((error: unknown) => {
    console.warn(`local D1 runtime of abandoned attempt ${attempt} did not stop cleanly:`, error)
  })
}

function createRuntime(persist: string, d1Databases: Record<string, string>): Miniflare {
  return new Miniflare({
    modules: true,
    script: LOCAL_D1_WORKER_SCRIPT,
    resourcePersistencePath: persist,
    d1Databases,
    outboundService: () => new Response("outbound is disabled in local D1 tests", { status: 503 }),
    // 実行中にworkerdが落ちるとMiniflareは作り直し、それ以前に得たDBは使えなくなる。原因を追えるよう記録する。
    unsafeHandleRuntimeRestart: () => {
      console.warn(
        "local D1 runtime restarted after an unexpected exit; earlier databases are invalid",
      )
    },
  })
}

/**
 * 全migration、または指定したschemaを一度だけ永続化DBへ適用する。
 * 実行環境を閉じてから複製するため、WALを含むファイル一式が静止した状態で使われる。
 */
function buildTemplate(schema?: string): Promise<Template> {
  const key = schema ?? ""
  const existing = templates.get(key)
  if (existing !== undefined) return existing

  const template = (async () => {
    const cache = templateCacheDirectory(schema)
    const cached = readCachedTemplate(cache)
    if (cached !== null) return cached
    const slots = Array.from({ length: RUNTIME_MIGRATED_SLOT_COUNT }, (_, index) =>
      slotIdFor(index),
    )
    const bindings = {
      [TEMPLATE_BINDING]: "local-d1-test-template",
      ...Object.fromEntries(slots.map((id, index) => [`SLOT_${index}`, id])),
    }
    const { runtime, persist: directory } = await startRuntime(
      () => join(scratchDirectory(), `template-${crypto.randomUUID()}`),
      { create: (persist) => createRuntime(persist, bindings) },
    )
    const objectDirectory = join(directory, D1_OBJECT_DIRECTORY)
    let objectCount: number
    const slotFiles: string[] = []
    try {
      const database = createLocalD1FetchClient(runtime, TEMPLATE_BINDING)
      if (schema === undefined) await applyMigrations(database)
      else await applySchema(database, schema)
      objectCount = await countSchemaObjects(database)
      // 枠のDBを1つずつ開き、Miniflareが作ったファイル名を記録する。ファイル名はidから決まる。
      for (const index of slots.keys()) {
        const before = new Set(databaseFiles(objectDirectory))
        const slot = createLocalD1FetchClient(runtime, `SLOT_${index}`)
        await slot.prepare("SELECT 1").run()
        const created = databaseFiles(objectDirectory).filter((file) => !before.has(file))
        const file = created.at(0)
        if (created.length !== 1 || file === undefined) {
          throw new Error(`could not locate the persisted file of local D1 slot ${index}`)
        }
        slotFiles.push(file)
      }
    } finally {
      await runtime.dispose()
    }
    const files = databaseFiles(objectDirectory).filter((file) => !slotFiles.includes(file))
    const file = files.at(0)
    if (files.length !== 1 || file === undefined) {
      throw new Error(`expected one persisted template database, found ${files.length}`)
    }
    return publishTemplate(cache, { directory, file, objectCount, slotFiles })
  })()

  templates.set(key, template)
  // 失敗したtemplateを再利用せず、次の呼び出しで作り直す。
  template.catch(() => {
    if (templates.get(key) === template) templates.delete(key)
  })

  return template
}

/** 作成したtemplateを置くディレクトリの名前。 */
const TEMPLATE_CACHE_ROOT = join(tmpdir(), "local-d1-test-template-cache")

/** 他のkeyのtemplateを消すまでの、最後の使用からの時間。 */
const TEMPLATE_CACHE_RETENTION_MS = 24 * 60 * 60 * 1000

/**
 * templateの内容を決める入力（全migrationまたはschema、枠の数、Miniflareの版）から作るcacheの位置。
 * testファイルごとに実行環境を作り直すrunner（`bun test --isolate`など）でも、
 * 同じ内容の適用はmachineで一度にする。入力が変われば別のkeyになり、古いtemplateを使わない。
 */
function templateCacheDirectory(schema: string | undefined): string {
  const hash = new Bun.CryptoHasher("sha256")
  hash.update(`slots:${RUNTIME_MIGRATED_SLOT_COUNT}\n`)
  hash.update(`miniflare:${miniflareVersion()}\n`)
  if (schema === undefined) {
    for (const file of readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      hash.update(`migration:${file}\n`)
      hash.update(readFileSync(join(migrationsDirectory, file)))
    }
  } else {
    hash.update("schema\n")
    hash.update(schema)
  }
  return join(TEMPLATE_CACHE_ROOT, hash.digest("hex"))
}

function miniflareVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(createRequire(import.meta.url).resolve("miniflare/package.json"), "utf8"),
  )
  if (typeof manifest !== "object" || manifest === null || !("version" in manifest)) {
    throw new Error("miniflare version is unavailable")
  }
  return String(manifest.version)
}

/** 公開済みのtemplateを読む。無いか形が合わなければ作り直させる。 */
function readCachedTemplate(cache: string): Template | null {
  const metadataPath = join(cache, "template.json")
  if (!existsSync(metadataPath)) return null
  const metadata: unknown = JSON.parse(readFileSync(metadataPath, "utf8"))
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("file" in metadata) ||
    !("objectCount" in metadata) ||
    !("slotFiles" in metadata) ||
    typeof metadata.file !== "string" ||
    typeof metadata.objectCount !== "number" ||
    !Array.isArray(metadata.slotFiles) ||
    metadata.slotFiles.length !== RUNTIME_MIGRATED_SLOT_COUNT ||
    !metadata.slotFiles.every((file) => typeof file === "string")
  ) {
    return null
  }
  const directory = join(cache, "persist")
  if (!existsSync(join(directory, D1_OBJECT_DIRECTORY, metadata.file))) return null
  const now = new Date()
  utimesSync(cache, now, now)
  return {
    directory,
    file: metadata.file,
    objectCount: metadata.objectCount,
    slotFiles: metadata.slotFiles,
  }
}

/**
 * 作ったtemplateをcacheへ公開する。別のプロセスが先に公開していればそちらを使う。
 * 公開は作業ディレクトリのrenameで行い、読み手へ書きかけのtemplateを見せない。
 */
function publishTemplate(cache: string, built: Template): Template {
  mkdirSync(TEMPLATE_CACHE_ROOT, { recursive: true })
  const staging = mkdtempSync(join(TEMPLATE_CACHE_ROOT, "staging-"))
  try {
    cpSync(built.directory, join(staging, "persist"), { recursive: true })
    writeFileSync(
      join(staging, "template.json"),
      JSON.stringify({
        file: built.file,
        objectCount: built.objectCount,
        slotFiles: built.slotFiles,
      }),
    )
    renameSync(staging, cache)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    if (!existsSync(join(cache, "template.json"))) throw error
  }
  rmSync(built.directory, { recursive: true, force: true })
  removeStaleTemplates(cache)
  return readCachedTemplate(cache) ?? built
}

/** 使われなくなった古いkeyのtemplateを消す。 */
function removeStaleTemplates(current: string): void {
  const threshold = Date.now() - TEMPLATE_CACHE_RETENTION_MS
  for (const entry of readdirSync(TEMPLATE_CACHE_ROOT)) {
    const path = join(TEMPLATE_CACHE_ROOT, entry)
    if (path === current) continue
    try {
      if (statSync(path).mtimeMs < threshold) rmSync(path, { recursive: true, force: true })
    } catch {
      // 別のプロセスが同時に消したtemplateは、消えていれば目的を果たしている。
    }
  }
}

/** SQLite本体とWALを複製する。shmは開いた側のSQLiteが作り直す。 */
function copyDatabaseFile(source: string, target: string): void {
  copyFileSync(source, target)
  if (existsSync(`${source}-wal`)) copyFileSync(`${source}-wal`, `${target}-wal`)
}

/** 複製がtemplateと同じschemaを持つことを確かめ、保存形式の変化を黙って見逃さない。 */
async function verifyCopy(name: string, database: D1Database, expected: number): Promise<void> {
  const actual = await countSchemaObjects(database)
  if (actual !== expected) {
    throw new Error(
      `local D1 "${name}" has ${actual} schema objects, expected ${expected} from its template`,
    )
  }
}

async function countSchemaObjects(database: D1Database): Promise<number> {
  const row = await database
    .prepare("SELECT count(*) AS count FROM sqlite_master")
    .first<{ count: number }>()
  return row?.count ?? -1
}

/** Durable Objectの管理用ファイルを除いた、D1本体のSQLiteファイル名。 */
function databaseFiles(directory: string): string[] {
  return readdirSync(directory).filter(
    (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite",
  )
}

/** migrations/ を番号順に、ファイル単位のbatchで適用する。 */
async function applyMigrations(database: D1Database): Promise<void> {
  for (const statements of loadMigrationStatements()) {
    if (statements.length === 0) continue
    await database.batch(statements.map((statement) => database.prepare(statement)))
  }
}

/** 指定したschemaを、1つのbatchで適用する。 */
async function applySchema(database: D1Database, schema: string): Promise<void> {
  const statements = splitSqlStatements(schema)
  if (statements.length === 0) return
  await database.batch(statements.map((statement) => database.prepare(statement)))
}

/** 作業ディレクトリを作ったプロセスのpidを置くファイル名。 */
export const SCRATCH_OWNER_FILE = "owner.pid"

/** 所有者の記録が無い作業ディレクトリを放置とみなすまでの時間。 */
const UNOWNED_SCRATCH_RETENTION_MS = 60 * 60 * 1000

function scratchDirectory(): string {
  if (scratchRoot !== null) return scratchRoot

  removeAbandonedScratchDirectories()
  const root = mkdtempSync(join(tmpdir(), "local-d1-test-"))
  writeFileSync(join(root, SCRATCH_OWNER_FILE), String(process.pid))
  scratchRoot = root
  process.on("exit", () => rmSync(root, { recursive: true, force: true }))

  return root
}

/**
 * 強制終了されたプロセスは作業ディレクトリを消せず、DBファイルがディスクに残る。
 * 所有プロセスが終わった作業ディレクトリと、所有者の記録が無い古い作業ディレクトリを消す。
 * templateのcacheと、他の名前のディレクトリには触れない。
 */
export function removeAbandonedScratchDirectories(
  root: string = tmpdir(),
  now: number = Date.now(),
): void {
  const threshold = now - UNOWNED_SCRATCH_RETENTION_MS
  for (const entry of readdirSync(root)) {
    const directory = join(root, entry)
    if (!entry.startsWith("local-d1-test-") || directory === TEMPLATE_CACHE_ROOT) continue
    if (entry === "local-d1-test-template-cache") continue
    try {
      const ownerPath = join(directory, SCRATCH_OWNER_FILE)
      const abandoned = existsSync(ownerPath)
        ? !isProcessAlive(Number(readFileSync(ownerPath, "utf8")))
        : statSync(directory).mtimeMs < threshold
      if (abandoned) rmSync(directory, { recursive: true, force: true })
    } catch {
      // 別のプロセスが同時に消した作業ディレクトリは、消えていれば目的を果たしている。
    }
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // 権限が無いだけのプロセスは生きている。
    return error instanceof Error && "code" in error && error.code === "EPERM"
  }
}

function loadMigrationStatements(): ReadonlyArray<ReadonlyArray<string>> {
  if (migrationStatements !== null) return migrationStatements

  migrationStatements = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => splitSqlStatements(readFileSync(join(migrationsDirectory, file), "utf8")))

  return migrationStatements
}
