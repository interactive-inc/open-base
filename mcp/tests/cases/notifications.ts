import { ids } from "@/tests/cases/ids"
import type { ToolCase } from "@/tests/support/tool-cases"

export const notificationCases: ReadonlyArray<ToolCase> = [
  {
    tool: "notifications_list",
    args: { read: false, limit: 10 },
    method: "GET",
    path: "/system/notifications",
    query: { read: "false", limit: "10" },
  },
  {
    tool: "notifications_unread_count",
    args: {},
    method: "GET",
    path: "/system/notifications/unread-count",
  },
  {
    tool: "notifications_show",
    args: { id: "delivery-1" },
    method: "GET",
    path: "/system/notifications/delivery-1",
  },
  {
    tool: "notifications_mark_read",
    args: { id: "delivery-1" },
    method: "PATCH",
    path: "/system/notifications/delivery-1",
    body: { read: true },
  },
  {
    tool: "notifications_mark_all_read",
    args: {},
    method: "PATCH",
    path: "/system/notifications",
    body: { read: true },
  },
  {
    tool: "notifications_delete",
    args: { id: "delivery-1" },
    method: "DELETE",
    path: "/system/notifications/delivery-1",
  },
  {
    tool: "company_notifications_send",
    args: { recipient_employee_code: "E001", kind: "reminder", title: "Reminder" },
    method: "POST",
    path: "/company/notifications",
    body: { recipient_employee_code: "E001", kind: "reminder", title: "Reminder" },
  },
  {
    tool: "system_notifications_send",
    args: {
      recipient_account_ids: [ids.a],
      kind: "example:reminder",
      title: "Reminder",
      source: { type: "example:task", id: "task-1" },
    },
    method: "POST",
    path: "/system/notifications",
    body: {
      recipient_account_ids: [ids.a],
      kind: "example:reminder",
      title: "Reminder",
      source: { type: "example:task", id: "task-1" },
    },
  },
]
