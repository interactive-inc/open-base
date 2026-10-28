export const reviewRouteManifest = [
  {
    method: "GET",
    path: "/performance-review/cycles",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/performance-review/interface/routes/performance-review.cycles",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/performance-review/cycles",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/performance-review/interface/routes/performance-review.cycles",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/performance-review/cycles/:id",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/performance-review/interface/routes/performance-review.cycles.$id",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/performance-review/sheets",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/performance-review/interface/routes/performance-review.sheets",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/performance-review/sheets",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/performance-review/interface/routes/performance-review.sheets",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/performance-review/sheets/:id",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/performance-review/interface/routes/performance-review.sheets.$id",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/performance-review/sheets/:id/commands",
    phase: "authenticated",
    handler: {
      kind: "module",
      module:
        "@/contexts/performance-review/interface/routes/performance-review.sheets.$id.commands",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/performance-review/sheets/:id/history",
    phase: "authenticated",
    handler: {
      kind: "module",
      module:
        "@/contexts/performance-review/interface/routes/performance-review.sheets.$id.history",
      exportName: "GET",
    },
  },
] as const
