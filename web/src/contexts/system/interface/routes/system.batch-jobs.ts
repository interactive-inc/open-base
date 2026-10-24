/** /system/batch-jobs */
import { ReadSystemBatchJobsAdapter } from "@system/infrastructure/adapters/batch/read-system-batch-jobs.adapter"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { SystemBatchUnavailableError, SystemForbiddenError } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission batch:view - System batch jobの実行履歴を読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "query",
    z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).max(10_000).default(0),
    }),
  ),
  async (context) => {
    if (
      !context.var.permissions.has("system:admin") &&
      !context.var.permissions.has(SystemFeaturePermission.BATCH_VIEW.key)
    ) {
      throw new SystemForbiddenError()
    }

    const query = context.req.valid("query")
    const page = await new ReadSystemBatchJobsAdapter({
      env: { DB: context.env.DB },
    }).readSystemBatchJobs(query)
    if (page instanceof Error) throw new SystemBatchUnavailableError(page)

    return context.json(
      {
        data: page.jobs.map((job) => ({
          id: job.id,
          name: job.name,
          status: job.status,
          started_at: job.startedAt?.toISOString() ?? null,
          finished_at: job.finishedAt?.toISOString() ?? null,
          message: job.message,
        })),
        total: page.total,
      },
      200,
    )
  },
)
