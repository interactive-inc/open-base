/** Applied filenames are immutable identities; pending DDL must follow the remote journal. */
export class MigrationJournal {
  static inspect(props: {
    appliedNames: ReadonlyArray<string>
    localNames: ReadonlyArray<string>
  }): ReadonlyArray<string> {
    const failures: string[] = []
    const local = new Set(props.localNames)
    const applied = new Set(props.appliedNames)
    const numbers = new Map<number, Set<string>>()
    if (local.size !== props.localNames.length || applied.size !== props.appliedNames.length) {
      failures.push("duplicate migration filename")
    }
    for (const name of new Set([...props.appliedNames, ...props.localNames])) {
      const match = /^(\d+)_.*\.sql$/.exec(name)
      const number = match === null ? NaN : Number(match[1])
      if (!Number.isSafeInteger(number)) {
        failures.push(`invalid migration filename: ${name}`)
        continue
      }
      const names = numbers.get(number) ?? new Set<string>()
      names.add(name)
      numbers.set(number, names)
    }
    for (const [number, names] of numbers) {
      if (names.size > 1)
        failures.push(`migration number ${number} is reused: ${[...names].sort().join(", ")}`)
    }
    for (const name of applied) {
      if (!local.has(name)) failures.push(`applied migration is missing locally: ${name}`)
    }
    const maximum = Math.max(
      -1,
      ...[...numbers]
        .filter((entry) => [...entry[1]].some((name) => applied.has(name)))
        .map((entry) => entry[0]),
    )
    for (const [number, names] of numbers) {
      for (const name of names) {
        if (!applied.has(name) && local.has(name) && number < maximum) {
          failures.push(`pending migration precedes applied history: ${name}`)
        }
      }
    }
    return failures
  }
}
