export type ApiRouteModuleTier = "system" | "company" | "business" | "composition"

export type ApiRouteModuleRegistration = Readonly<{
  context: string
  tier: ApiRouteModuleTier
  routesDirectory: string
  routeImportPrefix: string
}>

const contextNamePattern = /^[a-z][a-z0-9-]*$/

function expectedRoutesDirectory(context: string): string {
  return context === "api" ? "api/routes" : `contexts/${context}/interface/routes`
}

function expectedRouteImportPrefix(context: string): string {
  return context === "api"
    ? "@/api/routes"
    : context === "system"
      ? "@system/interface/routes"
      : `@/contexts/${context}/interface/routes`
}

/** System > Company > Business > API compositionの順序とroute sourceの一意性を検査する。 */
export function inspectApiRouteModuleRegistry(
  registry: ReadonlyArray<ApiRouteModuleRegistration>,
): ReadonlyArray<string> {
  const violations: string[] = []
  const contexts = new Set<string>()
  const routesDirectories = new Set<string>()
  const routeImportPrefixes = new Set<string>()

  for (const entry of registry.entries()) {
    const index = entry[0]
    const module = entry[1]

    if (!contextNamePattern.test(module.context)) {
      violations.push(`不正なcontext名です: ${module.context}`)
    } else if (contexts.has(module.context)) {
      violations.push(`contextが重複しています: ${module.context}`)
    }
    contexts.add(module.context)

    const expectedTier =
      index === 0
        ? "system"
        : index === 1
          ? "company"
          : module.context === "api"
            ? "composition"
            : "business"
    if (module.tier !== expectedTier) {
      violations.push(
        `${module.context}のtierは登録順${index + 1}では${expectedTier}である必要があります`,
      )
    }

    if (routesDirectories.has(module.routesDirectory)) {
      violations.push(`routes directoryが重複しています: ${module.routesDirectory}`)
    }
    routesDirectories.add(module.routesDirectory)

    if (module.routesDirectory !== expectedRoutesDirectory(module.context)) {
      violations.push(
        `${module.context}のroutes directoryが所有contextと一致しません: ${module.routesDirectory}`,
      )
    }

    if (routeImportPrefixes.has(module.routeImportPrefix)) {
      violations.push(`route import prefixが重複しています: ${module.routeImportPrefix}`)
    }
    routeImportPrefixes.add(module.routeImportPrefix)

    if (module.routeImportPrefix !== expectedRouteImportPrefix(module.context)) {
      violations.push(
        `${module.context}のroute import prefixが所有contextと一致しません: ${module.routeImportPrefix}`,
      )
    }

    if (module.tier === "composition" && index !== registry.length - 1) {
      violations.push("API compositionのroute sourceはregistryの末尾に置く必要があります")
    }
  }

  if (registry[0]?.context !== "system") {
    violations.push("registryの先頭はsystemである必要があります")
  }
  if (registry[1]?.context !== "company") {
    violations.push("registryの2番目はcompanyである必要があります")
  }

  return violations
}
