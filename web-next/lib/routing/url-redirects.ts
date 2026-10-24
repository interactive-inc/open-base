type Redirect = { source: string; destination: string; permanent: boolean }
const moves = [
  ["/employees", "/company/employees"],
  ["/departments", "/company/departments"],
  ["/grades", "/company/grades"],
  ["/positions", "/company/positions"],
  ["/accounts", "/system/accounts"],
  ["/roles", "/system/roles"],
  ["/batches", "/system/batches"],
  ["/audit-events", "/system/audit-events"],
  ["/application-templates", "/system/application-templates"],
  ["/applications", "/my/applications"],
] as const
export const urlRedirects: ReadonlyArray<Redirect> = [
  { source: "/applications/inbox", destination: "/inbox/applications", permanent: false },
  { source: "/applications/admin", destination: "/system/applications", permanent: false },
  ...moves.flatMap(([source, destination]) => [
    { source, destination, permanent: false },
    { source: `${source}/:path*`, destination: `${destination}/:path*`, permanent: false },
  ]),
]
