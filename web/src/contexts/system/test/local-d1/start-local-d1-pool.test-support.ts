import { startLocalD1 } from "@system/test/local-d1/start-local-d1.test-support"

export type LocalD1Pool = Readonly<{
  /** まだ誰も使っていないmigration済みDBを返す。同じDBを二度返さない。 */
  next: () => Promise<D1Database>
  dispose: () => Promise<void>
}>

/**
 * migration済みDBを指定した数だけ用意し、呼ばれた順に1つずつ渡す。
 * 共通fixtureがtestごとにDBを作る場合に、DB名をfixtureの引数へ通さずに済ませる。
 * 用意した数を超えて求めたら失敗させ、DBを共有しない。
 */
export async function startLocalD1Pool(size: number): Promise<LocalD1Pool> {
  const names = Array.from({ length: size }, (_, index) => `pooled-${index}`)
  const local = await startLocalD1({ migrated: names })
  let used = 0

  return {
    next: async () => {
      const name = names[used]
      if (name === undefined) {
        throw new Error(`local D1 pool of ${size} databases is exhausted; declare a larger pool`)
      }
      used += 1
      return local.database(name)
    },
    dispose: () => local.dispose(),
  }
}
