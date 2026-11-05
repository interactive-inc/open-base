export const workExecutionRouteManifest = [
  {
    method: "GET",
    path: "/work-execution/definitions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/work-execution/interface/routes/work-execution.definitions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/work-execution/definitions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/work-execution/interface/routes/work-execution.definitions",
      exportName: "POST",
    },
  },
  {
    method: "DELETE",
    path: "/work-execution/definitions/:slug",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/work-execution/interface/routes/work-execution.definitions.$slug",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/work-execution/runs",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/work-execution/interface/routes/work-execution.runs",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/work-execution/runs",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/work-execution/interface/routes/work-execution.runs",
      exportName: "POST",
    },
  },
] as const
