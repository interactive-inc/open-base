import { Database, SQLiteError } from "bun:sqlite"
import { chmod, mkdir } from "node:fs/promises"
import { join } from "node:path"

type Props = Readonly<{ directory: string }>

/** SQLiteのOS管理lockで設定の更新を直列化する。プロセス終了時にもlockは解放される。 */
export class AuthFileLock {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.props.directory, { recursive: true, mode: 0o700 })
    await chmod(this.props.directory, 0o700)
    const database = new Database(join(this.props.directory, ".auth-lock.sqlite"))
    const state = { acquired: false }

    try {
      await this.acquire(database, Date.now() + 30_000)
      state.acquired = true
      return await operation()
    } finally {
      try {
        if (state.acquired) database.exec("ROLLBACK")
      } finally {
        database.close()
      }
    }
  }

  private async acquire(database: Database, deadline: number): Promise<void> {
    try {
      database.exec("BEGIN IMMEDIATE")
    } catch (error) {
      if (!(error instanceof SQLiteError) || (error.errno & 255) !== 5) throw error
      if (Date.now() >= deadline) throw new Error("authentication settings are busy; retry later")

      await Bun.sleep(20)
      await this.acquire(database, deadline)
    }
  }
}
