# 従業員の期間参照

会社営業日を `?1` に束縛し、雇用・状態・主務・組織単位の最新revisionから半開区間のsnapshotを組み立てる。公開入口は `companyEmploymentStateSql`、`companyEmploymentStateTableSql`、`companyEmployeeDirectorySql`、`companyEmployeeProfileSql`。認可方針、書込み、製品固有の表示は持たない。

利用側は欠落・重複の検査結果を確認し、評価できないsnapshotを拒否する。表示用の雇用statusへfallbackしない。

`companyEmploymentStateTableSql` は雇用1件につき1行の派生表で、`CompanyEmployeeDirectoryReadAdapter.employmentStateTable` が呼び出し側の雇用行へ結合する。行ごとの相関サブクエリの中へ期間参照のWITHを展開しない。相関位置に置くと行数だけ改訂表を読み直し、本番で1回数十万行の読み取りになった。

検証は親ディレクトリの `resolve-live-employee-access.adapter.d1.test.ts` と `employee-directory-read.adapter.d1.test.ts` でローカルD1に対して行う。`create-employee-employment-test-database.test-support.ts` は期間境界と不整合の反例を作るテスト専用入口。

`companyEmployeeProfileSql` は、従業員ごとの正本から氏名、従業員 code、連絡先を読む CTE `employee_profiles` を返す。公開履歴へ接続済みの従業員は公開 Person と従業員の resource を読み、会社営業日に有効な版を優先して、無ければ最も新しい版を使う。未接続の従業員は、接続されるまでの原記録である従業員の表を読む。接続済みで有効な resource が無い場合は NULL を返し、表で補わない。検証は同じディレクトリの `company-employee-profile-sql.d1.test.ts` でローカルD1に対して行う。
