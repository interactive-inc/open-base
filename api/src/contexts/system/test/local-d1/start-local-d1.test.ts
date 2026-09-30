import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import type { Mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  SCRATCH_OWNER_FILE,
  type StartableRuntime,
  removeAbandonedScratchDirectories,
  startRuntime,
} from "@system/test/local-d1/start-local-d1.test-support"

type FakeRuntime = StartableRuntime &
  Readonly<{
    name: string
    resolve: () => void
    reject: (error: unknown) => void
    disposed: () => number
  }>

function fakeRuntime(name: string): FakeRuntime {
  let resolve: () => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const ready = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  let disposed = 0
  return {
    name,
    ready,
    resolve,
    reject,
    disposed: () => disposed,
    // Miniflareの停止と同じく、起動の失敗で停止も失敗させる。
    dispose: async () => {
      disposed += 1
      await ready
    },
  }
}

/** 投入した順に実行環境を返し、起動に使ったディレクトリ名を記録する。ディレクトリは作らない。 */
function factory(runtimes: ReadonlyArray<FakeRuntime>) {
  const root = join(tmpdir(), `start-runtime-test-${crypto.randomUUID()}`)
  const persists: string[] = []
  let next = 0
  return {
    persists,
    persistAt: (index: number) => join(root, `persist-${index}`),
    preparePersist: () => {
      const persist = join(root, `persist-${persists.length}`)
      persists.push(persist)
      return persist
    },
    create: () => {
      const runtime = runtimes[next]
      next += 1
      if (runtime === undefined) throw new Error("no fake runtime left")
      return runtime
    },
  }
}

/** 保留中のpromiseの続きを流す。 */
async function flush(): Promise<void> {
  for (let index = 0; index < 5; index++) await Promise.resolve()
}

let warn: Mock<typeof console.warn>

beforeEach(() => {
  warn = spyOn(console, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  warn.mockRestore()
})

describe("startRuntime", () => {
  test("起動が失敗したら新しいディレクトリで作り直し、失敗した実行環境を停止する", async () => {
    const failed = fakeRuntime("failed")
    const started = fakeRuntime("started")
    const runtimes = factory([failed, started])
    failed.reject(new Error("EBADF: bad file descriptor, send"))
    started.resolve()

    const result = await startRuntime(runtimes.preparePersist, {
      create: runtimes.create,
      restartDelaysMs: [0],
    })

    expect(result.runtime.name).toBe("started")
    expect(result.persist).toBe(runtimes.persistAt(1))
    expect(runtimes.persists).toEqual([runtimes.persistAt(0), runtimes.persistAt(1)])
    expect(failed.disposed()).toBe(1)
    expect(started.disposed()).toBe(0)
  })

  test("止まった起動を作り直した後で元の起動が失敗しても、未処理のrejectionにしない", async () => {
    const stalled = fakeRuntime("stalled")
    const started = fakeRuntime("started")
    const runtimes = factory([stalled, started])
    started.resolve()

    const result = await startRuntime(runtimes.preparePersist, {
      create: runtimes.create,
      stallMs: 1,
      restartDelaysMs: [0],
    })

    expect(result.runtime.name).toBe("started")
    expect(stalled.disposed()).toBe(1)

    const late = new Error("Failed to connect")
    stalled.reject(late)
    await flush()

    expect(warn.mock.calls.map((call) => call[0])).toContain(
      "local D1 runtime of abandoned attempt 1 failed later:",
    )
    expect(warn.mock.calls.find((call) => call[1] === late)).toBeDefined()
  })

  test("全ての起動が失敗したら最後の失敗を投げ、どの実行環境も停止する", async () => {
    const runtimes = [fakeRuntime("first"), fakeRuntime("second"), fakeRuntime("third")]
    const last = new Error("ENOENT: Failed to connect")
    const failures = [new Error("EBADF"), new Error("EBADF"), last]
    const created = factory(runtimes)
    let index = 0

    const failure = await startRuntime(created.preparePersist, {
      // 起動した時点で失敗させ、観測前のrejectionを作らない。
      create: () => {
        const runtime = created.create()
        runtime.reject(failures[index])
        index += 1
        return runtime
      },
      attempts: 3,
      restartDelaysMs: [0],
    }).then(
      () => null,
      (error: unknown) => error,
    )

    expect(failure).toBe(last)
    expect(runtimes.map((runtime) => runtime.disposed())).toEqual([1, 1, 1])
  })

  test("起動が成功した実行環境は停止しない", async () => {
    const started = fakeRuntime("started")
    started.resolve()
    const runtimes = factory([started])

    const result = await startRuntime(runtimes.preparePersist, {
      create: runtimes.create,
      restartDelaysMs: [0],
    })

    expect(result.runtime).toBe(started)
    expect(started.disposed()).toBe(0)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("強制終了で残った作業ディレクトリの片付け", () => {
  const hour = 60 * 60 * 1000
  let root = ""

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "local-d1-scratch-cleanup-"))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function scratch(name: string, owner?: number): string {
    const directory = join(root, name)
    mkdirSync(directory)
    if (owner !== undefined) writeFileSync(join(directory, SCRATCH_OWNER_FILE), String(owner))
    return directory
  }

  /** 起動して終了を待った子プロセスのpidは、もう動いていない。 */
  async function deadPid(): Promise<number> {
    const child = Bun.spawn(["true"])
    await child.exited
    return child.pid
  }

  test("所有プロセスが終わった作業ディレクトリを消す", async () => {
    const directory = scratch("local-d1-test-dead", await deadPid())
    removeAbandonedScratchDirectories(root)
    expect(existsSync(directory)).toBe(false)
  })

  test("所有プロセスが動いている作業ディレクトリは残す", () => {
    const directory = scratch("local-d1-test-live", process.pid)
    const past = new Date(Date.now() - 2 * hour)
    utimesSync(directory, past, past)
    removeAbandonedScratchDirectories(root)
    expect(existsSync(directory)).toBe(true)
  })

  test("所有者の記録が無い作業ディレクトリは1時間を過ぎたものだけを消す", () => {
    const now = Math.floor(Date.now() / 1000) * 1000
    const old = scratch("local-d1-test-unowned-old")
    const past = new Date(now - hour - 60_000)
    utimesSync(old, past, past)
    const fresh = scratch("local-d1-test-unowned-fresh")
    const boundary = scratch("local-d1-test-unowned-boundary")
    const cutoff = new Date(now - hour)
    utimesSync(boundary, cutoff, cutoff)
    removeAbandonedScratchDirectories(root, now)
    expect(existsSync(old)).toBe(false)
    expect(existsSync(fresh)).toBe(true)
    expect(existsSync(boundary)).toBe(true)
  })

  test("templateのcacheと他の名前のディレクトリには触れない", async () => {
    const cache = scratch("local-d1-test-template-cache")
    const past = new Date(Date.now() - 2 * hour)
    utimesSync(cache, past, past)
    const other = scratch("other-directory", await deadPid())
    removeAbandonedScratchDirectories(root)
    expect(existsSync(cache)).toBe(true)
    expect(existsSync(other)).toBe(true)
  })
})
