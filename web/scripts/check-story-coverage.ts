import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const groups = [
  ["src/pages", "stories/pages"],
  ["src/components/app", "stories/app"],
] as const
let count = 0
for (const [source, stories] of groups) {
  // 下の階層の画面も対象にする。story は同じ階層・同じ名前で置く。
  for (const name of await readdir(resolve(root, source), { recursive: true })) {
    if (!name.endsWith(".tsx")) continue
    // レイアウトはVoidの共有データとルーターに結び付くので、Storybookでは描けない。
    // 枠の見た目と操作は AppShell のstoryで確かめる。
    if (name === "layout.tsx" || name.startsWith("_layouts/")) continue
    const stem = name.slice(0, -4)
    const story = await readFile(
      resolve(root, stories, `${stem === "index" ? "home" : stem}.stories.tsx`),
      "utf8",
    )
    if (!story.includes(source.replace("src/", "@/") + "/" + stem))
      throw new Error(`Story must import its subject: ${name}`)
    count++
  }
}
console.log(`Story coverage verified ${count} page/component modules`)
