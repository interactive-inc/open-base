-- 入社・退職の発令に対応させるテンプレートの設定は onboarding が所有する。
-- Company はこの table を読み書きしないため、行を保全したまま所有contextの接頭辞へ改名する。
ALTER TABLE company_lifecycle_effect_template_bindings RENAME TO onboarding_lifecycle_template_bindings;
