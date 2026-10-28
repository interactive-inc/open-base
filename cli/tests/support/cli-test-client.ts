/** 実CLIを別processで起動し、標準出力と失敗を呼び出し元へ返す。 */
export function createCliTestClient(input: {
  entry: string
  baseUrl: string
  configDirectory: string
}) {
  return async (arguments_: ReadonlyArray<string>) => {
    const process_ = Bun.spawn([process.execPath, input.entry, ...arguments_], {
      env: { ...process.env, BASE_API: input.baseUrl, BASE_CONFIG_DIR: input.configDirectory },
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await Promise.all([
      process_.exited,
      new Response(process_.stdout).text(),
      new Response(process_.stderr).text(),
    ])
    return { code: output[0], stdout: output[1], stderr: output[2] }
  }
}
