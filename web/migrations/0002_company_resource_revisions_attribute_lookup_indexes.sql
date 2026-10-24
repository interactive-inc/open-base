-- 属性で絞る Company の照会（Account 対応の Account・従業員、雇用の従業員）が、版を選ぶ前に
-- 候補の resource を引くための部分式索引。認証の前段が毎回走らせる照会は、組織内の全 link・全雇用の
-- 全版を順位付けしてから本人で絞っており、行数が履歴とともに増えていた。
-- 種別の述語を持たない照会（person / employee を IN で引く CTE など）からは使われないよう、部分索引にする。
CREATE INDEX `company_resource_revisions_link_account_lookup_idx`
  ON `company_resource_revisions` (`organization_id`, json_extract(`attributes_json`, '$.accountId'))
  WHERE `resource_type` = 'account-employee-link';
CREATE INDEX `company_resource_revisions_link_employee_lookup_idx`
  ON `company_resource_revisions` (`organization_id`, json_extract(`attributes_json`, '$.employeeId'))
  WHERE `resource_type` = 'account-employee-link';
CREATE INDEX `company_resource_revisions_employment_employee_lookup_idx`
  ON `company_resource_revisions` (`organization_id`, json_extract(`attributes_json`, '$.employeeId'))
  WHERE `resource_type` = 'employment';
