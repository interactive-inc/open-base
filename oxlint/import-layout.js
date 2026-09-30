// Oxlint JS plugin for import layout rules that the built-in import plugin does not cover.
// `import/first` and `import/newline-after-import` handle placement and the blank line after the final import.

const blankLinePattern = /\n[ \t]*\n/
const blankLinesPattern = /\n(?:[ \t]*\n)+/g

const noBlankLineBetweenImports = {
  meta: {
    type: "layout",
    docs: {
      description: "Disallow blank lines between consecutive import declarations.",
    },
    fixable: "whitespace",
    messages: {
      blankLine: "Remove the blank line between import declarations.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const text = context.sourceCode.text
        const body = program.body
        for (let index = 1; index < body.length; index += 1) {
          const previous = body[index - 1]
          const current = body[index]
          if (previous.type !== "ImportDeclaration" || current.type !== "ImportDeclaration") {
            continue
          }
          const between = text.slice(previous.range[1], current.range[0])
          if (!blankLinePattern.test(between)) {
            continue
          }
          context.report({
            node: current,
            messageId: "blankLine",
            fix(fixer) {
              return fixer.replaceTextRange(
                [previous.range[1], current.range[0]],
                between.replace(blankLinesPattern, "\n"),
              )
            },
          })
        }
      },
    }
  },
}

export default {
  meta: { name: "import-layout" },
  rules: {
    "no-blank-line-between-imports": noBlankLineBetweenImports,
  },
}
