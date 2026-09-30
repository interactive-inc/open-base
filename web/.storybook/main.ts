import { fileURLToPath } from "node:url"
import { defineMain } from "@storybook/react-vite/node"

const webRoot = fileURLToPath(new URL("..", import.meta.url))

export default defineMain({
  stories: ["../components/**/*.stories.@(ts|tsx)", "../app/**/*.stories.@(ts|tsx)"],
  framework: "@storybook/react-vite",
  viteFinal(config) {
    config.resolve ??= {}
    const alias = config.resolve.alias
    const aliases = Array.isArray(alias)
      ? alias
      : Object.entries(alias ?? {}).map(([find, replacement]) => ({ find, replacement }))

    aliases.push({ find: "@", replacement: webRoot })
    config.resolve.alias = aliases

    return config
  },
})
