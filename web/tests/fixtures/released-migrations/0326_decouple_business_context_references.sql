-- 業務context同士は直接依存しない。別の業務が所有する記録を指す列名を、所有contextが解釈しない参照へ改める。
-- 列名の変更だけで行と値は保持し、外部キーは作らない。

-- 1on1は評価シートを読まず書かず、APIへも出していない。過去の値を不透明な外部参照として残す。
DROP INDEX IF EXISTS idx_one_on_ones_evaluation_sheet;
ALTER TABLE one_on_ones RENAME COLUMN evaluation_sheet_id TO external_reference;

-- 文書台帳の相手先は利用者が入力する自由記述で、取引先台帳の存在を検査しない。
ALTER TABLE document_ledger_entries RENAME COLUMN partner_code TO counterparty_reference;
