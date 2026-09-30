import childProcess from "node:child_process"
import type { ChildProcess, SpawnOptions } from "node:child_process"
import { spawnWorkerdWithBun } from "@system/test/local-d1/spawn-workerd-with-bun.test-support"

let installed = false

const failures: unknown[] = []

/** 動いているworkerdのpidと、その終了を待つpromise。 */
const running = new Map<number, Promise<void>>()

/**
 * Miniflareが起動するworkerdの子プロセスについて、起動とstdioの失敗を受け止める。
 *
 * Bunは子プロセスの起動やpipeの作成に失敗すると（EBADF、ENOENTなど）、子プロセスや
 * そのstreamへ`error`を送る。Miniflareはこれらへ`error`の受け手を付けないため、
 * 失敗はtestの外で未処理のerrorになる。ここではworkerdのspawn直後に子プロセスと全stdioへ
 * 受け手を付けて失敗を記録する。
 *
 * stdioの失敗ではworkerdとの制御pipeが使えないため、workerdを止めてMiniflareの起動を失敗させ、
 * 呼び出し側の起動の作り直しで扱う。子プロセス自体への失敗は起動を止めないことがあるため
 * 記録だけを行い、起動の成否はMiniflareの結果に従う。記録した失敗は起動の失敗の原因として出す。
 */
export function installWorkerdStdioGuard(): void {
  if (installed) return
  installed = true
  const spawn = childProcess.spawn
  const guarded = function (this: unknown, ...args: unknown[]) {
    const [command, commandArgs, options] = args
    if (!isWorkerd(command) || !Array.isArray(commandArgs)) {
      return Reflect.apply(spawn, this, args) as ChildProcess
    }
    // workerdだけはBunのsocketによるpipeを使わずに起動する（spawn-workerd-with-bun.ts）。
    const child = spawnWorkerdWithBun(
      command as string,
      commandArgs as string[],
      (options ?? {}) as SpawnOptions,
    )
    guard(child)
    return child
  }
  childProcess.spawn = guarded as typeof spawn
}

/** これまでに記録したworkerdの失敗を取り出し、記録を空にする。 */
export function takeWorkerdStdioFailures(): unknown[] {
  return failures.splice(0)
}

/** 動いているworkerdのpid。止まった要求の記録や、testがworkerdの終了を再現する時に使う。 */
export function runningWorkerdPids(): ReadonlyArray<number> {
  return [...running.keys()]
}

/** 指定したworkerdが終了するまで待つ。既に終了していればすぐに返る。 */
export function workerdExited(pid: number): Promise<void> {
  return running.get(pid) ?? Promise.resolve()
}

function isWorkerd(command: unknown): boolean {
  return typeof command === "string" && /[\\/]workerd(?:\.exe)?$/.test(command)
}

function guard(child: ChildProcess): void {
  child.on("error", (error: unknown) => {
    failures.push(error)
  })
  const pid = child.pid
  if (pid !== undefined) {
    running.set(
      pid,
      new Promise<void>((resolve) => {
        child.once("exit", () => {
          running.delete(pid)
          resolve()
        })
      }),
    )
  }
  for (const stream of child.stdio) {
    stream?.on("error", (error: unknown) => {
      failures.push(error)
      child.kill("SIGKILL")
    })
  }
}
