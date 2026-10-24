import { S3Client } from "bun"

/** 添付本体のobject key。Systemは `att/{uuid}` だけを作り、ファイル名を含めない。 */
export const ATTACHMENT_OBJECT_KEY = /^att\/[0-9A-Za-z-]{1,128}$/

export type AttachmentObjectSummary = Readonly<{ key: string; lastModified: Date | null }>

/** 運用scriptが使うS3互換storageの最小操作。製品は特定のvendorを前提にしない。 */
export type AttachmentObjectStorage = Readonly<{
  list(input: {
    prefix: string
    continuationToken?: string
  }): Promise<{ objects: ReadonlyArray<AttachmentObjectSummary>; nextContinuationToken?: string }>
  read(key: string): Promise<Uint8Array>
  write(key: string, body: Uint8Array): Promise<void>
}>

const STORAGE_VARIABLES = ["ENDPOINT", "BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY"] as const

/**
 * `<prefix>_ENDPOINT`、`_BUCKET`、`_ACCESS_KEY_ID`、`_SECRET_ACCESS_KEY`、任意の`_REGION`から
 * S3互換storageの接続設定を読む。全て未設定ならnull、一部だけの設定はErrorを返す。
 */
export function readAttachmentStorageConfig(
  env: Readonly<Record<string, string | undefined>>,
  prefix: string,
) {
  const values = STORAGE_VARIABLES.map((name) => env[`${prefix}_${name}`]?.trim() ?? "")
  if (values.every((value) => value === "")) return null
  const missing = STORAGE_VARIABLES.filter((_, index) => values[index] === "")
  if (missing.length > 0)
    return new Error(`${missing.map((name) => `${prefix}_${name}`).join(", ")} is not set`)
  const [endpoint, bucket, accessKeyId, secretAccessKey] = values as [
    string,
    string,
    string,
    string,
  ]
  if (!URL.canParse(endpoint)) return new Error(`${prefix}_ENDPOINT is not a URL`)
  const region = env[`${prefix}_REGION`]?.trim()
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: region === undefined || region === "" ? "auto" : region,
  }
}

export function createS3AttachmentObjectStorage(
  config: Exclude<ReturnType<typeof readAttachmentStorageConfig>, Error | null>,
): AttachmentObjectStorage {
  const client = new S3Client(config)
  return {
    async list(input) {
      const response = await client.list({
        prefix: input.prefix,
        continuationToken: input.continuationToken,
      })
      return {
        objects: (response.contents ?? []).map((object) => ({
          key: object.key,
          lastModified: object.lastModified === undefined ? null : new Date(object.lastModified),
        })),
        nextContinuationToken: response.isTruncated ? response.nextContinuationToken : undefined,
      }
    },
    async read(key) {
      return new Uint8Array(await client.file(key).arrayBuffer())
    },
    async write(key, body) {
      await client.write(key, body, { type: "application/octet-stream" })
    },
  }
}
