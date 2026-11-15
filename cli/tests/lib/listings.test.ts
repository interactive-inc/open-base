import { help as adminHelp } from "@/app/application-requests/admin/route"
import { help as meHelp } from "@/app/application-requests/me/route"
import { help as sendAccountsHelp } from "@/app/notifications/send-accounts/route"
import { help as eventsHelp } from "@/app/personnel-actions/events/route"
import { help as requestsHelp } from "@/app/personnel-actions/requests/route"
import { createCliFixtures } from "@/tests/support/create-cli-fixtures"
import { describeApiCommands } from "@/tests/support/describe-api-commands"

const fixtures = createCliFixtures("listings")
const notification = {
  recipient_account_ids: ["account-1"],
  kind: "example:notice",
  title: "お知らせ",
}
const notificationFile = fixtures.writeJson("notification.json", notification)

describeApiCommands({
  group: "application-requests",
  help: adminHelp,
  cases: [
    {
      name: "admin",
      argv: [
        "application-requests",
        "admin",
        "--status",
        "pending",
        "--template-code",
        "leave",
        "--limit",
        "20",
      ],
      expected: {
        method: "GET",
        path: "/company/application-requests/admin",
        query: { status: "pending", template_code: "leave", limit: "20" },
      },
    },
  ],
})

describeApiCommands({
  group: "application-requests",
  help: meHelp,
  cases: [
    {
      name: "me",
      argv: ["application-requests", "me", "--offset", "40"],
      expected: {
        method: "GET",
        path: "/company/application-requests/me",
        query: { offset: "40" },
      },
    },
  ],
})

describeApiCommands({
  group: "personnel-actions",
  help: eventsHelp,
  cases: [
    {
      name: "events",
      argv: ["personnel-actions", "events", "--after-sequence", "120", "--limit", "50"],
      expected: {
        method: "GET",
        path: "/company/personnel-action-events",
        query: { after_sequence: "120", limit: "50" },
      },
    },
  ],
})

describeApiCommands({
  group: "personnel-actions",
  help: requestsHelp,
  cases: [
    {
      name: "requests",
      argv: [
        "personnel-actions",
        "requests",
        "--target-employee-code",
        "E001",
        "--status",
        "pending",
      ],
      expected: {
        method: "GET",
        path: "/company/personnel-action-requests",
        query: { target_employee_code: "E001", status: "pending" },
      },
    },
  ],
})

describeApiCommands({
  group: "notifications",
  help: sendAccountsHelp,
  cases: [
    {
      name: "send-accounts",
      argv: ["notifications", "send-accounts", "--data", notificationFile],
      expected: { method: "POST", path: "/system/notifications", body: notification },
    },
  ],
})
