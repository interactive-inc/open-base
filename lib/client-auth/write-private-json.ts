import { randomUUID } from "node:crypto"
import { rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

type Props = Readonly<{ directory: string; file: string; value: unknown }>

/** 保護済みdirectory内で原子的に置換し、読み手へ書きかけの認証情報を見せない。 */
export async function writePrivateJson(props: Props): Promise<void> {
  const temporaryFile = join(props.directory, `.settings-${randomUUID()}.tmp`)

  try {
    await writeFile(temporaryFile, `${JSON.stringify(props.value, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    })
    await rename(temporaryFile, props.file)
  } finally {
    await rm(temporaryFile, { force: true })
  }
}
