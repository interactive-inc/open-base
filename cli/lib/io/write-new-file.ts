import { writeFile } from "node:fs/promises"
import { InputError } from "@/lib/errors"

/** 取得した本文を、既存のファイルを上書きせず本人だけが読める権限で保存する。 */
export async function writeNewFile(path: string, bytes: Uint8Array): Promise<void> {
  try {
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 })
  } catch {
    throw new InputError("保存できません。未使用の出力先を指定してください")
  }
}
