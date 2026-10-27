import type { DBAdapter } from "better-auth"
import { ensureAuthUser } from "./ensure-auth-user.ts"

type Adapter = Pick<DBAdapter, "findOne" | "create" | "update" | "deleteMany">

/** Systemの現在の資格情報を認証基盤へ写す。停止・変更前の資格情報ではログインさせない。 */
export async function preparePasswordSignIn(
  database: D1Database,
  adapter: Adapter,
  email: string,
): Promise<void> {
  const { findSystemPasswordSignInAccount } =
    await import("@system/interface/operations/find-system-password-sign-in-account")
  const identity = await findSystemPasswordSignInAccount(
    { env: { DB: database } },
    { email, now: new Date() },
  )
  if (identity instanceof Error) throw identity
  if (identity === null) {
    const user = await adapter.findOne<{ id: string }>({
      model: "user",
      where: [{ field: "email", value: email }],
    })
    if (user !== null)
      await adapter.deleteMany({
        model: "account",
        where: [
          { field: "userId", value: user.id },
          { field: "providerId", value: "credential" },
        ],
      })
    return
  }
  await ensureAuthUser(
    {
      context: {
        adapter,
        internalAdapter: {
          findUserById: (id) =>
            adapter.findOne({ model: "user", where: [{ field: "id", value: id }] }),
        },
      },
    },
    identity,
  )
  const where = [
    { field: "userId", value: identity.accountId },
    { field: "providerId", value: "credential" },
  ]
  const data = {
    accountId: identity.accountId,
    password: identity.passwordHash,
    updatedAt: new Date(),
  }
  const existing = await adapter.findOne<{ id: string }>({ model: "account", where })
  if (existing !== null) {
    await adapter.update({
      model: "account",
      where: [{ field: "id", value: existing.id }],
      update: data,
    })
    return
  }
  try {
    await adapter.create({
      model: "account",
      forceAllowId: true,
      data: {
        ...data,
        id: identity.accountId,
        userId: identity.accountId,
        providerId: "credential",
        createdAt: data.updatedAt,
      },
    })
  } catch (error) {
    const raced = await adapter.findOne<{ id: string }>({ model: "account", where })
    if (raced === null) throw error
    await adapter.update({
      model: "account",
      where: [{ field: "id", value: raced.id }],
      update: data,
    })
  }
}
