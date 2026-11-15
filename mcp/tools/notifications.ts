import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { destructive, readOnly, registerApiTool, segment, write } from "@/lib/api-tool"
import { intentNote } from "@/lib/tool-inputs"
import { companyNotificationKindSchema } from "../../web/src/api/http/notifications/notification-kind.definition"
import {
  notificationKindSchema,
  notificationSourceReferenceSchema,
} from "../../web/src/contexts/system/domain/schemas/notifications/notification-reference.schema"

const notificationId = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/)
  .describe("Notification delivery ID")

/** 自分宛ての通知の一覧・既読・非表示と、通知の送信を扱う。 */
export function registerNotificationTools(server: McpServer) {
  registerApiTool(server, {
    name: "notifications_list",
    description: "List notifications delivered to my Account, newest first.",
    annotations: readOnly,
    input: {
      read: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).max(10_000).optional(),
    },
    request: (query) => ({ path: "/system/notifications", query }),
  })
  registerApiTool(server, {
    name: "notifications_unread_count",
    description: "Count my unread notifications.",
    annotations: readOnly,
    input: {},
    request: () => ({ path: "/system/notifications/unread-count" }),
  })
  registerApiTool(server, {
    name: "notifications_show",
    description: "Read one notification delivered to me.",
    annotations: readOnly,
    input: { id: notificationId },
    request: ({ id }) => ({ path: `/system/notifications/${segment(id)}` }),
  })
  registerApiTool(server, {
    name: "notifications_mark_read",
    description: `Mark one of my notifications as read. ${intentNote}`,
    annotations: { ...write, idempotentHint: true },
    input: { id: notificationId },
    request: ({ id }) => ({
      path: `/system/notifications/${segment(id)}`,
      method: "PATCH",
      json: { read: true },
    }),
  })
  registerApiTool(server, {
    name: "notifications_mark_all_read",
    description: `Mark all of my unread notifications as read. ${intentNote}`,
    annotations: { ...write, idempotentHint: true },
    input: {},
    request: () => ({ path: "/system/notifications", method: "PATCH", json: { read: true } }),
  })
  registerApiTool(server, {
    name: "notifications_delete",
    description: `Hide one of my notifications. ${intentNote}`,
    annotations: destructive,
    input: { id: notificationId },
    request: ({ id }) => ({ path: `/system/notifications/${segment(id)}`, method: "DELETE" }),
  })
  registerApiTool(server, {
    name: "company_notifications_send",
    description: `Send a notification to one Company employee by employee code. ${intentNote}`,
    annotations: write,
    input: {
      recipient_employee_code: z.string().min(1).max(200),
      kind: companyNotificationKindSchema.optional(),
      title: z.string().min(1).max(200),
      body: z.string().max(5_000).optional(),
      source_domain: z.string().max(100).optional(),
      source_id: z.number().int().positive().optional(),
    },
    request: (body) => ({ path: "/company/notifications", method: "POST", json: body }),
  })
  registerApiTool(server, {
    name: "system_notifications_send",
    description: `Deliver a notification to up to 100 active System Accounts. Kinds and source types are namespaced (for example example:reminder). Requires notification:send. ${intentNote}`,
    annotations: write,
    input: {
      recipient_account_ids: z.array(z.uuid()).min(1).max(100),
      kind: notificationKindSchema,
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(10_000).nullable().optional(),
      source: notificationSourceReferenceSchema.nullable().optional(),
      action: notificationSourceReferenceSchema.nullable().optional(),
      resource_scope: notificationSourceReferenceSchema.nullable().optional(),
      priority: z.enum(["low", "normal", "high", "critical"]).optional(),
    },
    request: (body) => ({ path: "/system/notifications", method: "POST", json: body }),
  })
}
