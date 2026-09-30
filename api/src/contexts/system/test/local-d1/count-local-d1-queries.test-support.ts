/**
 * D1Databaseへの問い合わせ回数を数える。文の実行ごとに1回、batchは含む文の数、execは1回と数える。
 * SQLの実行は受け取ったD1Databaseへそのまま渡し、結果と失敗を変えない。
 */
export function countLocalD1Queries(
  database: D1Database,
  /** 数えるたびに呼ぶ。batchは含む文の数だけ呼ぶ。 */
  onQuery?: () => void,
): {
  database: D1Database
  count: () => number
  reset: () => void
} {
  let queries = 0
  const add = (count: number) => {
    queries += count
    for (let index = 0; index < count; index += 1) onQuery?.()
  }

  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
    const counted = {
      bind: (...values: unknown[]) => wrap(statement.bind(...values)),
      first: (column?: string) => {
        add(1)
        return column === undefined ? statement.first() : statement.first(column)
      },
      all: () => {
        add(1)
        return statement.all()
      },
      run: () => {
        add(1)
        return statement.run()
      },
      raw: (options?: { columnNames?: boolean }) => {
        add(1)
        return options?.columnNames === true
          ? statement.raw({ columnNames: true })
          : statement.raw()
      },
      [INNER]: statement,
    }
    return counted as unknown as D1PreparedStatement
  }

  const unwrap = (statement: D1PreparedStatement): D1PreparedStatement =>
    (statement as unknown as { [INNER]?: D1PreparedStatement })[INNER] ?? statement

  const counted = {
    prepare: (query: string) => wrap(database.prepare(query)),
    batch: (statements: D1PreparedStatement[]) => {
      add(statements.length)
      return database.batch(statements.map(unwrap))
    },
    exec: (query: string) => {
      add(1)
      return database.exec(query)
    },
    dump: () => database.dump(),
    withSession: (constraint?: string) => database.withSession(constraint),
  }

  return {
    database: counted as unknown as D1Database,
    count: () => queries,
    reset: () => {
      queries = 0
    },
  }
}

const INNER = Symbol("counted D1 statement")
