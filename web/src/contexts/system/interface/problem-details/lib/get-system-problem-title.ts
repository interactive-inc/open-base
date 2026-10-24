export type SystemProblemStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 413
  | 415
  | 422
  | 423
  | 429
  | 500
  | 502
  | 503

const titles: Readonly<Record<SystemProblemStatus, string>> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  423: "Locked",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
}

/** RFC 9457のtitleをHTTP statusごとに安定させる。 */
export function getSystemProblemTitle(status: SystemProblemStatus): string {
  return titles[status]
}
