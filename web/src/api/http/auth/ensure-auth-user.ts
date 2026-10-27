type UserCreationContext = Readonly<{
  context: {
    internalAdapter: { findUserById(id: string): Promise<unknown> }
    adapter: {
      create(input: {
        model: string
        forceAllowId: boolean
        data: Record<string, unknown>
      }): Promise<unknown>
    }
  }
}>

/**
 * System AccountのIDでBetter Authのユーザーを用意する。既にあれば何もしない。
 * ユーザーは通常の作成を拒否しているので、Systemが本人と確かめたときだけここで作る。
 */
export async function ensureAuthUser(
  ctx: UserCreationContext,
  input: Readonly<{ accountId: string; email: string | null }>,
): Promise<void> {
  const existing = await ctx.context.internalAdapter.findUserById(input.accountId)
  if (existing !== null) return
  // メールアドレスが無いIdentityでも一意になるよう、送信できない予約済みのdomainで補う。
  const email = input.email ?? `${input.accountId}@users.invalid`
  const now = new Date()
  try {
    await ctx.context.adapter.create({
      model: "user",
      forceAllowId: true,
      data: {
        id: input.accountId,
        email,
        name: email,
        emailVerified: input.email !== null,
        createdAt: now,
        updatedAt: now,
      },
    })
  } catch (cause) {
    // 同時の初回サインインで先に作成された場合だけ、その同一Accountを使う。
    if ((await ctx.context.internalAdapter.findUserById(input.accountId)) === null) throw cause
  }
}
