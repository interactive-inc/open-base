import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    semi: false,
    ignorePatterns: [".agents/**", ".claude/**"],
  },
  lint: {
    ignorePatterns: [".agents/**", ".claude/**"],
    options: {
      typeAware: true,
    },
    plugins: ["import", "typescript", "unicorn", "oxc"],
    jsPlugins: ["./oxlint/import-layout.js"],
    rules: {
      "import/first": "error",
      "import/newline-after-import": [
        "error",
        { count: 1, exactCount: true, considerComments: true },
      ],
      "import-layout/no-blank-line-between-imports": "error",
    },
    overrides: [
      {
        // System と Company は共通基盤を採用する別製品と全ファイルを同一に保ち、hash で固定している。
        // この製品だけで書き換えると同一性が崩れるため、import 配置の規則を適用しない。
        // shadcn の生成物も直接編集しないため除外する。
        files: [
          "api/src/contexts/system/**",
          "api/src/contexts/company/**",
          "web/components/ui/**",
        ],
        rules: {
          "import/first": "off",
          "import/newline-after-import": "off",
          "import-layout/no-blank-line-between-imports": "off",
        },
      },
    ],
  },
})
