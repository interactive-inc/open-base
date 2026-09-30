import { loadConfig } from "@/lib/config/load-config"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * config は BASE_CONFIG_DIR を実行時に参照するので、一時ディレクトリへ隔離して検証する。
 * （os.homedir() は Bun が起動時にキャッシュするため実行時の HOME 変更では隔離できない）
 */
describe("config (endpoints 形式)", () => {
  let originalConfigDir: string | undefined

  let tempDir: string

  const baseUrl = "https://api-a.example.com"

  beforeEach(async () => {
    originalConfigDir = process.env.BASE_CONFIG_DIR
    tempDir = await mkdtemp(join(tmpdir(), "base-config-"))
    process.env.BASE_CONFIG_DIR = tempDir
  })

  afterEach(async () => {
    if (originalConfigDir === undefined) {
      delete process.env.BASE_CONFIG_DIR
    } else {
      process.env.BASE_CONFIG_DIR = originalConfigDir
    }

    await rm(tempDir, { recursive: true, force: true })
  })

  async function readSettings(): Promise<Record<string, unknown>> {
    const raw = await readFile(join(tempDir, "settings.json"), "utf8")

    return JSON.parse(raw)
  }

  test("saveLogin writes a 4-field string entry keyed by the resolved base url", async () => {
    await new SettingsFile().saveLogin(
      baseUrl,
      { token: "access-a", refresh_token: "refresh-a" },
      "you@example.com",
      "You Example",
    )

    const settings = await readSettings()

    // 書き込みキーは resolveBaseUrl の戻りと完全一致する（末尾スラッシュ事故の検出）。
    expect(Object.keys(settings.endpoints as object)).toEqual([resolveBaseUrl(baseUrl)])

    const entry = (settings.endpoints as Record<string, unknown>)[baseUrl]

    expect(entry).toEqual({
      refreshToken: "refresh-a",
      accessToken: "access-a",
      email: "you@example.com",
      name: "You Example",
    })
  })

  test("preserves other CLIs' entries with unknown fields across two writes", async () => {
    await mkdir(tempDir, { recursive: true })

    // 先行 CLI が書いた別エンドポイントと、同一エンドポイントの独自フィールド。
    await writeFile(
      join(tempDir, "settings.json"),
      JSON.stringify({
        version: 3,
        endpoints: {
          "https://other.example.com": {
            refreshToken: "other-refresh",
            accessToken: "other-access",
            email: "other@example.com",
            name: "Other User",
            extraField: "keep-me",
          },
          [baseUrl]: {
            refreshToken: "old-refresh",
            accessToken: "old-access",
            email: "you@example.com",
            name: "You Example",
            expiresAt: "keep-me-too",
          },
        },
      }),
    )

    await new SettingsFile().saveLogin(
      baseUrl,
      { token: "access-a", refresh_token: "refresh-a" },
      "you@example.com",
      "You Example",
    )

    // tokens-only 経路の merge 漏れも検出するため 2 回書き込む。
    await new SettingsFile().saveTokens(baseUrl, {
      token: "access-a2",
      refresh_token: "refresh-a2",
    })

    const settings = await readSettings()

    // 未知の root キーも温存する。
    expect(settings.version).toBe(3)

    const endpoints = settings.endpoints as Record<string, Record<string, unknown>>

    // 他エンドポイントのエントリと余剰フィールドが両方の書き込み後も残る。
    expect(endpoints["https://other.example.com"]).toEqual({
      refreshToken: "other-refresh",
      accessToken: "other-access",
      email: "other@example.com",
      name: "Other User",
      extraField: "keep-me",
    })

    // 自分のエントリは email / name と独自フィールドを温存しトークンだけ更新される。
    expect(endpoints[baseUrl]).toEqual({
      refreshToken: "refresh-a2",
      accessToken: "access-a2",
      email: "you@example.com",
      name: "You Example",
      expiresAt: "keep-me-too",
    })
  })

  test("saveTokens creates an entry with empty email/name when none exists", async () => {
    await new SettingsFile().saveTokens(baseUrl, {
      token: "access-a",
      refresh_token: "refresh-a",
    })

    const entry = (await readSettings()).endpoints as Record<string, unknown>

    expect(entry[baseUrl]).toEqual({
      refreshToken: "refresh-a",
      accessToken: "access-a",
      email: "",
      name: "",
    })
  })

  test('stores a null refresh_token as "" and reads it back as null', async () => {
    await new SettingsFile().saveLogin(
      baseUrl,
      { token: "access-a", refresh_token: null },
      "you@example.com",
      "You Example",
    )

    const entry = (await readSettings()).endpoints as Record<string, Record<string, unknown>>

    // 先行 CLI が全フィールド string を要求するため "" で保存する。
    expect(entry[baseUrl].refreshToken).toBe("")

    const loaded = await loadConfig(baseUrl)

    // 読み込みでは "" を null に戻す。
    expect(loaded.refresh_token).toBeNull()
    expect(loaded.token).toBe("access-a")
    expect(loaded.base_url).toBe(baseUrl)
  })

  test("loadConfig returns null tokens when the endpoint entry is absent", async () => {
    const loaded = await loadConfig(baseUrl)

    expect(loaded.token).toBeNull()
    expect(loaded.refresh_token).toBeNull()
  })

  test("write hardens dir to 0700 and file to 0600 even if pre-existing perms are loose", async () => {
    // mkdtemp の既定は 0700 なので、chmod 消し漏れを検出するため先に緩めておく。
    await chmod(tempDir, 0o755)

    await new SettingsFile().saveLogin(
      baseUrl,
      { token: "access-a", refresh_token: "refresh-a" },
      "you@example.com",
      "You Example",
    )

    const dirStat = await stat(tempDir)
    const fileStat = await stat(join(tempDir, "settings.json"))

    expect(dirStat.mode & 0o777).toBe(0o700)
    expect(fileStat.mode & 0o777).toBe(0o600)
  })

  test("re-hardens an existing world-readable file to 0600", async () => {
    await mkdir(tempDir, { recursive: true })

    const file = join(tempDir, "settings.json")

    await writeFile(file, "{}\n")
    await chmod(file, 0o644)

    await new SettingsFile().saveTokens(baseUrl, {
      token: "access-a",
      refresh_token: "refresh-a",
    })

    const fileStat = await stat(file)

    expect(fileStat.mode & 0o777).toBe(0o600)
  })

  test("loadConfig falls back to defaults on malformed JSON", async () => {
    await mkdir(tempDir, { recursive: true })

    await writeFile(join(tempDir, "settings.json"), "{ this is not valid json")

    const loaded = await loadConfig(baseUrl)

    expect(loaded.token).toBeNull()
    expect(loaded.refresh_token).toBeNull()
  })

  test("refuses to overwrite a malformed file (protects other CLIs' entries)", async () => {
    await mkdir(tempDir, { recursive: true })

    await writeFile(join(tempDir, "settings.json"), "{ this is not valid json")

    // 破損ファイルを endpoints 形式で上書きすると他 CLI のエントリを全消去してしまうため中断する。
    const outcome = await new SettingsFile()
      .saveLogin(
        baseUrl,
        { token: "access-a", refresh_token: "refresh-a" },
        "you@example.com",
        "You Example",
      )
      .then(() => null)
      .catch((error: unknown) => error)

    expect(outcome).toBeInstanceOf(Error)
  })

  test("treats an empty file as no config", async () => {
    await mkdir(tempDir, { recursive: true })

    await writeFile(join(tempDir, "settings.json"), "")

    const loaded = await loadConfig(baseUrl)

    expect(loaded.token).toBeNull()
  })
})
