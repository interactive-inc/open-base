import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AuthFileLock } from "@base/client-auth/auth-file-lock"

test("independent lock instances serialize operations and release after failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-auth-lock-"))
  const activity: string[] = []

  try {
    await Promise.all(
      [1, 2].map((number) =>
        new AuthFileLock({ directory }).run(async () => {
          activity.push(`start-${number}`)
          await Bun.sleep(10)
          activity.push(`end-${number}`)
        }),
      ),
    )
    expect(activity).toHaveLength(4)
    expect(activity[0]).toMatch(/^start-/)
    expect(activity[1]).toBe(activity[0]?.replace("start-", "end-"))
    expect(activity[2]).toMatch(/^start-/)
    expect(activity[3]).toBe(activity[2]?.replace("start-", "end-"))
    expect(activity[0]).not.toBe(activity[2])
    const failure = await new AuthFileLock({ directory })
      .run(async () => {
        throw new Error("failed")
      })
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect(await new AuthFileLock({ directory }).run(async () => "recovered")).toBe("recovered")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("a terminated owner cannot leave a stale lock that blocks later authentication", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-auth-owner-"))
  const child = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `
    import { AuthFileLock } from "@base/client-auth/auth-file-lock";
    await new AuthFileLock({directory:process.env.BASE_CONFIG_DIR}).run(async()=>{
      console.log("locked"); await Bun.sleep(60000);
    });
  `,
    ],
    {
      cwd: new URL("../../", import.meta.url).pathname,
      env: { ...process.env, BASE_CONFIG_DIR: directory },
      stdout: "pipe",
      stderr: "pipe",
    },
  )

  try {
    const chunk = await child.stdout.getReader().read()
    expect(new TextDecoder().decode(chunk.value)).toContain("locked")
    child.kill()
    await child.exited
    expect(await new AuthFileLock({ directory }).run(async () => "recovered")).toBe("recovered")
  } finally {
    child.kill()
    await child.exited
    await rm(directory, { recursive: true, force: true })
  }
}, 10_000)
