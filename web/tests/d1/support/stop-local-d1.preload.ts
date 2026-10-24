import { afterAll } from "bun:test"
import { stopLocalD1 } from "@system/test/local-d1/start-local-d1.test-support"

// 全testファイルの後に、プロセスで共有したローカルD1のworkerdと作業ディレクトリを片付ける。
afterAll(async () => {
  await stopLocalD1()
})
