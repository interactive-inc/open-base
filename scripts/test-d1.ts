const apiRoot = new URL("../api/", import.meta.url).pathname
const files = Array.from(
  new Bun.Glob("src/contexts/**/*.d1.test.ts").scanSync({ cwd: apiRoot }),
).sort()
const result = Bun.spawnSync([process.execPath, "test", ...files.map((file) => `./${file}`)], {
  cwd: apiRoot,
  stdout: "inherit",
  stderr: "inherit",
})
process.exit(result.exitCode)
