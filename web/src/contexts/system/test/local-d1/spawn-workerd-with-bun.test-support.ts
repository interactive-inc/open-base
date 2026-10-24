import type { ChildProcess, SpawnOptions } from "node:child_process"
import { EventEmitter } from "node:events"
import { Readable, Writable } from "node:stream"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"

/**
 * workerdを`Bun.spawn`で起動し、Miniflareが使うChildProcessの形で返す。
 *
 * Miniflareは`node:child_process`の`spawn`で標準入出力と制御用のfd 3をpipeにする。
 * Bunの`node:child_process`はfd 3などのpipeをsocketの接続として作り、同じプロセスで
 * 子プロセスの起動と停止を重ねると、この接続が相手を持たないまま作られることがある。
 * その時workerdは設定を読めないか制御pipeへ書けず（Broken pipe）、起動が止まる。
 * `Bun.spawn`はfd 3をOSのpipeとして直接渡すため、この接続を経由しない。
 *
 * Miniflareが使う範囲（stdin・stdout・stderr・stdio[3]、pid、kill、exit・close）だけを実装する。
 */
export function spawnWorkerdWithBun(
  command: string,
  args: ReadonlyArray<string>,
  options: SpawnOptions,
): ChildProcess {
  const env = Object.fromEntries(
    Object.entries(options.env ?? process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
  const subprocess = Bun.spawn([command, ...args], {
    stdio: ["pipe", "pipe", "pipe", "pipe"],
    env,
  })
  const control = subprocess.stdio[3]
  if (typeof control !== "number") throw new Error("workerd control pipe was not created")

  const sink = subprocess.stdin
  const stdin = new Writable({
    write(chunk: Uint8Array, _encoding, callback) {
      try {
        sink.write(chunk)
        Promise.resolve(sink.flush()).then(
          () => callback(),
          (error: unknown) => callback(asError(error)),
        )
      } catch (error) {
        callback(asError(error))
      }
    },
    final(callback) {
      try {
        Promise.resolve(sink.end()).then(
          () => callback(),
          (error: unknown) => callback(asError(error)),
        )
      } catch (error) {
        callback(asError(error))
      }
    },
    destroy(error, callback) {
      try {
        void Promise.resolve(sink.end()).catch(() => undefined)
      } catch {
        // 既に閉じたpipeを閉じ直す失敗は、元の失敗より優先しない。
      }
      callback(error)
    },
  })
  const stdout = Readable.fromWeb(subprocess.stdout as unknown as NodeReadableStream)
  const stderr = Readable.fromWeb(subprocess.stderr as unknown as NodeReadableStream)
  const controlPipe = Readable.fromWeb(Bun.file(control).stream() as unknown as NodeReadableStream)

  const child = Object.assign(new EventEmitter(), {
    pid: subprocess.pid,
    stdin,
    stdout,
    stderr,
    stdio: [stdin, stdout, stderr, controlPipe],
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    killed: false,
    kill(signal: NodeJS.Signals | number = "SIGTERM") {
      child.killed = true
      subprocess.kill(signal)
      return true
    },
  })

  void subprocess.exited.then((code) => {
    const signal = (subprocess.signalCode as NodeJS.Signals | null) ?? null
    child.exitCode = signal === null ? code : null
    child.signalCode = signal
    child.emit("exit", child.exitCode, signal)
    child.emit("close", child.exitCode, signal)
  })

  return child as unknown as ChildProcess
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
