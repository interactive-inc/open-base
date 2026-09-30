/**
 * Company の API が要求する organization の識別子。導入ごとに一つだけの会社組織で、
 * api の共有 Company context が既知の UUID に固定している。cli は api の実行時の値を import しないため、
 * 同じ値をここに置く。
 */
export const companyOrganizationId = "ad4f6cb1-774b-43ae-950f-80e9bc67c66d" as const
