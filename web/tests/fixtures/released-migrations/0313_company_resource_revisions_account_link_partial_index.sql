-- account-employee-link の改訂行だけを持つ部分索引。company_account_employee_link_periods ビューの
-- 内側（resource_type = 'account-employee-link' で絞る）はこれで走査範囲が link 行だけになり、
-- person / employee を IN で引く ranked_workforce_resources CTE は述語が一致しないため使えない。
-- the shared system context（the shared repository）と Company schema を一致させる。
CREATE INDEX `company_resource_revisions_account_link_idx`
  ON `company_resource_revisions` (`organization_id`, `resource_id`)
  WHERE `resource_type` = 'account-employee-link';
