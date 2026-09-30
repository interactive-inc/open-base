const kindLabels: Readonly<Record<string, string>> = {
  hire: "入社",
  rehire: "再入社",
  primary_assignment_started: "配属",
  transferred: "異動",
  concurrent_assignment_started: "兼務開始",
  assignment_ended: "所属終了",
  position_changed: "役職変更",
  manager_changed: "上司変更",
  department_responsibility_started: "部署責任者就任",
  department_responsibility_ended: "部署責任者退任",
  leave_started: "休職",
  returned: "復職",
  retired: "退職",
  corrected: "訂正",
  initial_state: "初期状態",
  employment_revised: "雇用情報の改訂",
}

export function formatLifecycleKind(kind: string): string {
  return kindLabels[kind] ?? kind
}
