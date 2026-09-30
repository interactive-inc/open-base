import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { z } from "zod"

export type EndpointTokens = {
  token: string | null
  refresh_token: string | null
}

const zEndpoint = z.object({
  refreshToken: z.string(),
  accessToken: z.string(),
  email: z.string(),
  name: z.string(),
})

type Endpoint = z.infer<typeof zEndpoint>

type Root = Record<string, unknown> & { endpoints: Record<string, unknown> }

/**
 * ~/.config/base/settings.json（接続先ごとの endpoints 形式）を読み書きする。
 * 他エンドポイントのエントリは形式が想定外でもそのまま温存する。トークンを含むためファイルは 0600。
 */
export class SettingsFile {
  private readonly dir: string

  private readonly file: string

  constructor() {
    const dir = process.env.BASE_CONFIG_DIR ?? join(homedir(), ".config", "base")

    this.dir = dir

    this.file = join(dir, "settings.json")

    Object.freeze(this)
  }

  /**
   * 指定 URL のエントリからトークンを取り出す。エントリが無ければ両方 null。
   * 空文字は「未設定」として null に戻す（保存時は "" を使う）。
   */
  async tokensFor(baseUrl: string): Promise<EndpointTokens> {
    const root = await this.read()

    if (root instanceof Error) {
      // 読み取り権限・I/O エラーを「JSON 解析失敗」と誤表示して握り潰さないよう伝播させる。
      if (root instanceof SyntaxError === false) {
        throw root
      }

      // 破損 JSON は warning + 既定値で続行する（読み取り専用パスを塞がない）。
      process.stderr.write(`warning: ${this.file} を解析できませんでした。既定設定で続行します\n`)

      return { token: null, refresh_token: null }
    }

    const parsed = zEndpoint.safeParse(root.endpoints[baseUrl])

    if (parsed.success === false) {
      return { token: null, refresh_token: null }
    }

    return {
      token: parsed.data.accessToken === "" ? null : parsed.data.accessToken,
      refresh_token: parsed.data.refreshToken === "" ? null : parsed.data.refreshToken,
    }
  }

  /**
   * ログイン時のエントリ upsert。email / name / トークンを揃えて書き込む。
   */
  async saveLogin(
    baseUrl: string,
    tokens: EndpointTokens,
    email: string,
    name: string,
  ): Promise<void> {
    await this.write(baseUrl, tokens, { email, name })
  }

  /**
   * トークンのみ更新（refresh 後）。既存エントリの email / name は温存し、無ければ "" で作る。
   */
  async saveTokens(baseUrl: string, tokens: EndpointTokens): Promise<void> {
    await this.write(baseUrl, tokens, null)
  }

  private async write(
    baseUrl: string,
    tokens: EndpointTokens,
    identity: { email: string; name: string } | null,
  ): Promise<void> {
    const root = await this.read()

    if (root instanceof Error) {
      // 読み取り権限・I/O エラーは「JSON 解析失敗」と誤表示せずそのまま伝播させる。
      if (root instanceof SyntaxError === false) {
        throw root
      }

      // 破損ファイルを endpoints 形式で上書きすると他の接続先のエントリを全消去してしまう。
      // 既存の設定を守るため、修正・削除を促して中断する。
      throw new Error(
        `${this.file} を解析できませんでした。修正するか削除してから再実行してください`,
      )
    }

    const previous = toRawEntry(root.endpoints[baseUrl])

    const existing = zEndpoint.safeParse(previous)

    // 同一エンドポイントのエントリに保存済みの追加フィールドを消さないよう、生の既存
    // エントリへ上書きする形でマージする。email / name は identity 指定時のみ差し替える。
    const entry: Record<string, unknown> & Endpoint = {
      ...previous,
      refreshToken: tokens.refresh_token ?? "",
      accessToken: tokens.token ?? "",
      email: identity !== null ? identity.email : existing.success ? existing.data.email : "",
      name: identity !== null ? identity.name : existing.success ? existing.data.name : "",
    }

    const merged: Root = { ...root, endpoints: { ...root.endpoints, [baseUrl]: entry } }

    // 初回ログイン時にディレクトリが無いと ENOENT になるため先に作成する（dir は 0700）。
    await mkdir(this.dir, { recursive: true, mode: 0o700 })

    // トークンを含むため作成時点から所有者のみ読み書き可（0600）にする。
    // Bun.write + 後追い chmod だと作成〜chmod の間に world-readable な TOCTOU 窓があった。
    await writeFile(this.file, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 })

    // writeFile / mkdir の mode は新規作成時のみ有効で、既存の権限は据え置かれる。
    // 緩い権限で先に存在していたケースでも確実に締めるため、書き込み後に明示的に chmod する
    // （排他書き込み直後なので新たな TOCTOU リスクはない）。
    await chmod(this.dir, 0o700)
    await chmod(this.file, 0o600)
  }

  private async read(): Promise<Root | Error> {
    let raw: string

    try {
      raw = await readFile(this.file, "utf8")
    } catch (error) {
      if (isNotFound(error)) {
        return { endpoints: {} }
      }

      // 読み取り権限・I/O エラーは「JSON 解析失敗」と誤表示せずそのまま伝播させる。
      return error instanceof Error ? error : new Error(String(error))
    }

    if (raw.trim() === "") {
      return { endpoints: {} }
    }

    let value: unknown

    try {
      value = JSON.parse(raw)
    } catch {
      return new SyntaxError("invalid settings JSON")
    }

    if (typeof value !== "object" || value === null) {
      return new SyntaxError("settings root is not an object")
    }

    // 未知の root キー・エントリを温存するため、raw な形のまま保持する。
    const root: Record<string, unknown> = { ...value }

    const endpoints = root.endpoints

    if (typeof endpoints !== "object" || endpoints === null) {
      return { ...root, endpoints: {} }
    }

    return { ...root, endpoints: { ...endpoints } }
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

function toRawEntry(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {}
  }

  return { ...value }
}
