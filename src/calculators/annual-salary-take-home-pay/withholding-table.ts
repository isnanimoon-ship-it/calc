/**
 * 근로소득 간이세액표 조회 모듈 — `src/data/withholding-tax-table-2026.json`을 읽어
 * 이진 탐색으로 조회한다.
 *
 * tasks/annual-salary-take-home-pay/ARCHITECTURE.md "2. 핵심 결정 — 대용량 근로소득
 * 간이세액표 데이터 파일 설계"의 계약(`isWithinWithholdingTableRange`,
 * `lookupWithholdingTaxRow`) 그대로. `business-days/holidays.ts`(원본 JSON을 읽어 조회
 * 전용 함수를 제공하는 계산기 전용 모듈) 패턴을 따른다 — `logic.ts`가 JSON을 직접 import해
 * 순회하지 않고, 이 모듈이 조회 책임을 캡슐화한다.
 *
 * 이 파일이 만들지 않는(=참조만 하는) 것: `src/data/withholding-tax-table-2026.json`은
 * 이미 오케스트레이터가 국가법령정보센터 원문을 프로그램적으로 파싱해 생성했고 구조
 * 불변식·Golden Test 대조를 마쳤다 — 이 파일을 다시 만들거나 수정하지 않는다.
 */

import withholdingTable2026 from "@/src/data/withholding-tax-table-2026.json";

export interface WithholdingTaxRow {
  minWon: number;
  maxWon: number;
  taxByFamilyCount: Record<string, number>;
}

const rows: WithholdingTaxRow[] = withholdingTable2026.rows;

/** FORMULA.md "range"와 일치(첫 행 minWon, 마지막 행 maxWon) — 1천만원 초과 판정의 SSOT. */
export const WITHHOLDING_TABLE_RANGE = withholdingTable2026.range;

export const WITHHOLDING_TABLE_META = {
  effectiveFrom: withholdingTable2026.effectiveFrom,
  source: withholdingTable2026.source,
  lastVerified: withholdingTable2026.lastVerified,
  nextReviewDue: withholdingTable2026.nextReviewDue,
  familyCountColumns: withholdingTable2026.familyCountColumns,
} as const;

/**
 * `taxableMonthlyPay`(원 단위)가 세액표가 다루는 범위(770,000원 이상, 10,000,000원 미만) 안에
 * 있는지 판정한다. 하한 미만은 표 범위 밖(0원 처리는 호출부 책임), 상한(1천만원) 이상은
 * 1천만원 초과 산식(policy.ts) 대상이다.
 */
export function isWithinWithholdingTableRange(taxableMonthlyPay: number): boolean {
  return (
    taxableMonthlyPay >= WITHHOLDING_TABLE_RANGE.minWon &&
    taxableMonthlyPay < WITHHOLDING_TABLE_RANGE.maxWon
  );
}

/**
 * `taxableMonthlyPay`가 속한 행을 이진 탐색으로 찾는다. 행은 `minWon` 오름차순 정렬,
 * `이상 ~ 미만`(하한 포함, 상한 미포함) 구간이다. 범위 밖이면 `null`을 반환한다
 * (770,000원 미만은 세액표 최저구간 이하로 호출부가 0원 처리, 10,000,000원 이상은
 * policy.ts의 1천만원 초과 산식으로 호출부가 분기한다).
 */
export function lookupWithholdingTaxRow(taxableMonthlyPay: number): WithholdingTaxRow | null {
  if (!isWithinWithholdingTableRange(taxableMonthlyPay)) return null;

  let low = 0;
  let high = rows.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const row = rows[mid];
    if (taxableMonthlyPay < row.minWon) {
      high = mid - 1;
    } else if (taxableMonthlyPay >= row.maxWon) {
      low = mid + 1;
    } else {
      return row;
    }
  }
  return null;
}
