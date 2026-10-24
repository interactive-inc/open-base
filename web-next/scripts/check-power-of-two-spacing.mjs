#!/usr/bin/env bun
// web/app と web/components（web/components/ui と *.stories.tsx を除く）を対象に、
// 2の冪以外の spacing 値が使われていないかを検査する。
// 対象クラス: gap-*, gap-x-*, gap-y-*, p-*/px-*/py-*/pt-*/pb-*/pl-*/pr-*,
//            m-*/mx-*/my-*/mt-*/mb-*/ml-*/mr-*, space-x-*/space-y-*
// variant（sm: md: lg: など）付き、負のマージン（-mt-2 等）、任意値（p-[...]）も検査する。
// 使ってよい値: 0, 2, 4, 8, 16, 32, 64, px （詳細は web/DESIGN.md の「間隔（Spacing）」を参照）
//
// 実行: bun web/scripts/check-power-of-two-spacing.mjs [--list]

import { readdirSync, statSync, readFileSync } from "node:fs"
import { join, relative, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const TARGET_DIRS = ["app", "components"]
const EXCLUDE_DIR_SEGMENTS = ["components/ui"]
const EXCLUDE_FILE_SUFFIXES = [".stories.tsx"]

const PREFIXES = [
  "gap-x",
  "gap-y",
  "gap",
  "px",
  "py",
  "pt",
  "pb",
  "pl",
  "pr",
  "p",
  "mx",
  "my",
  "mt",
  "mb",
  "ml",
  "mr",
  "m",
  "space-x",
  "space-y",
]
const sortedPrefixes = [...PREFIXES].sort((a, b) => b.length - a.length)
const prefixAlt = sortedPrefixes.join("|")

// variant: (sm:|md:|lg:|xl:|2xl:|hover:|focus: など任意個)、先頭の負号（-mt-2 等）も許容
const variantPart = "(?:[a-zA-Z0-9_-]+:)*"
const valuePart = "(?:\\[[^\\]\\s\"'`]+\\]|[0-9]+(?:\\.[0-9]+)?)"
const pattern = new RegExp(
  `(?<![\\w-])${variantPart}-?(${prefixAlt})-(${valuePart})(?![\\w-])`,
  "g",
)

const ALLOWED_NUMS = new Set(["0", "2", "4", "8", "16", "32", "64"])

function isAllowedValue(raw) {
  if (raw === "px") return true
  if (raw.startsWith("[")) return false // 任意値は一律違反
  return ALLOWED_NUMS.has(raw)
}

function shouldSkipDir(relPath) {
  return EXCLUDE_DIR_SEGMENTS.some((seg) => relPath === seg || relPath.startsWith(seg + "/"))
}

function shouldSkipFile(relPath) {
  return EXCLUDE_FILE_SUFFIXES.some((suf) => relPath.endsWith(suf))
}

function walk(dir, results) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    const rel = relative(WEB_ROOT, full)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (shouldSkipDir(rel)) continue
      walk(full, results)
    } else if (st.isFile()) {
      if (!/\.(tsx|ts)$/.test(entry)) continue
      if (shouldSkipFile(rel)) continue
      results.push(full)
    }
  }
}

const files = []
for (const d of TARGET_DIRS) {
  walk(join(WEB_ROOT, d), files)
}

let violationCount = 0
const perValue = new Map()
const violations = []

for (const file of files) {
  const content = readFileSync(file, "utf8")
  const lines = content.split("\n")
  lines.forEach((line, idx) => {
    pattern.lastIndex = 0
    let m
    while ((m = pattern.exec(line))) {
      const rawValue = m[2]
      if (isAllowedValue(rawValue)) continue
      violationCount++
      perValue.set(rawValue, (perValue.get(rawValue) || 0) + 1)
      violations.push({
        file: relative(WEB_ROOT, file),
        line: idx + 1,
        match: m[0],
      })
    }
  })
}

console.log(`Total violations: ${violationCount}`)
console.log(`Files scanned: ${files.length}`)
console.log("\nBy value:")
for (const [val, count] of [...perValue.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${val}: ${count}`)
}

if (process.argv.includes("--list")) {
  console.log("\nViolations:")
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${v.match}`)
  }
}

process.exit(violationCount > 0 ? 1 : 0)
