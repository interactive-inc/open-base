import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)", "../stories/**/*.mdx"],
  staticDirs: ["./public"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-themes"],
  core: { disableTelemetry: true },
  docs: { defaultName: "使い方" },
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), tailwindcss()],
      resolve: {
        ...config.resolve,
        alias: [
          {
            find: /^.*\/auth-client$/,
            replacement: fileURLToPath(
              new URL("../../packages/mock/src/auth-client.ts", import.meta.url),
            ),
          },
          { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
        ],
      },
    }
  },
  framework: {
    name: "@storybook/react-vite",
    options: { builder: { viteConfigPath: "./.storybook/vite.config.ts" } },
  },
}

export default config
