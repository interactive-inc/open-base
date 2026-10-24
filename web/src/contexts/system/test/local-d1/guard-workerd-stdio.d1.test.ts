import { afterAll, expect, setDefaultTimeout, test } from "bun:test"
import childProcess from "node:child_process"
import type { ChildProcess } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  installWorkerdStdioGuard,
  takeWorkerdStdioFailures,
} from "@system/test/local-d1/guard-workerd-stdio.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const directory = mkdtempSync(join(tmpdir(), "guard-workerd-stdio-"))

afterAll(() => {
  rmSync(directory, { recursive: true, force: true })
})

/** 子プロセスの終了を待つ。`events.once`は`error`でrejectするため、終了だけを待つ。 */
function exitOf(child: ChildProcess): Promise<[number | null, NodeJS.Signals | null]> {
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve([code, signal]))
  })
}

/** workerdと同じ名前で起動する、入力を待ち続けるだけの実行ファイル。 */
function fakeWorkerd(): string {
  const path = join(directory, crypto.randomUUID(), "workerd")
  mkdirSync(dirname(path))
  symlinkSync("/bin/cat", path)
  return path
}

test("workerdのstdioの失敗を記録してworkerdを止め、未処理のerrorにしない", async () => {
  installWorkerdStdioGuard()
  takeWorkerdStdioFailures()
  const child = childProcess.spawn(fakeWorkerd(), [], { stdio: ["pipe", "pipe", "pipe", "pipe"] })
  const exited = exitOf(child)
  const failure = new Error("Failed to connect")

  child.stdio[3]?.emit("error", failure)
  const [code, signal] = await exited

  // 実行環境によってはBun自身もpipeの作成失敗を同じstreamへ送るため、送った失敗が含まれることだけを見る。
  expect(takeWorkerdStdioFailures()).toContain(failure)
  expect(code).toBeNull()
  expect(signal).toBe("SIGKILL")
})

test("workerdの子プロセスへの失敗を記録し、未処理のerrorにしない", async () => {
  installWorkerdStdioGuard()
  takeWorkerdStdioFailures()
  const child = childProcess.spawn(fakeWorkerd(), [], { stdio: ["pipe", "pipe", "pipe", "pipe"] })
  const exited = exitOf(child)
  const failure = new Error("EBADF: bad file descriptor, epoll_ctl")

  child.emit("error", failure)

  expect(takeWorkerdStdioFailures()).toContain(failure)
  expect(child.killed).toBe(false)
  child.stdin?.end()
  await exited
})

test("workerd以外の子プロセスのstdioには手を加えない", async () => {
  installWorkerdStdioGuard()
  takeWorkerdStdioFailures()
  const child = childProcess.spawn("/bin/cat", [], { stdio: ["pipe", "pipe", "pipe"] })
  const exited = exitOf(child)

  expect(child.stdout?.listenerCount("error")).toBe(0)
  child.stdin?.end()
  const [code] = await exited

  expect(code).toBe(0)
  expect(takeWorkerdStdioFailures()).toEqual([])
})
