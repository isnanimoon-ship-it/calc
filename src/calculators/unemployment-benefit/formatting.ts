/**
 * 실업급여(구직급여) 계산기 — 표시용 포맷팅.
 *
 * docs/CALCULATOR_RULES.md "금액/숫자 연산": 화면 표시는 Intl.NumberFormat('ko-KR')로 통일한다.
 */

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 원 단위로 반올림한 금액을 "1,234,567원" 형태로 표시한다. */
export function formatWon(amountWon: number): string {
  return `${wonFormatter.format(Math.round(amountWon))}원`;
}

/** 일수를 "270일" 형태로 표시한다. */
export function formatDays(days: number): string {
  return `${wonFormatter.format(days)}일`;
}

/** 나이를 "50세" 형태로 표시한다. */
export function formatAge(age: number): string {
  return `${wonFormatter.format(age)}세`;
}

/** 비율(0.6 등 무차원 소수)을 "60%" 형태로 표시한다. FORMULA.md "단위": 표시는 %. */
export function formatRatio(ratio: number): string {
  return `${wonFormatter.format(Math.round(ratio * 100))}%`;
}

/**
 * 1일 평균임금/구직급여일액처럼 아직 원 단위로 확정되지 않았을 수 있는 값(소수 포함)을
 * 참고용으로 소수 둘째 자리까지 보여준다. logic.ts의 averageDailyWage/
 * baseBenefitDailyAmount는 FORMULA.md 정책에 따라 반올림하지 않은 완전정밀도 값이므로,
 * 화면에는 이 함수로 소수를 적당히 잘라 보여주고 별도의 계산 재사용은 하지 않는다.
 */
export function formatWonDetailed(amountWon: number): string {
  const rounded = Math.round(amountWon * 100) / 100;
  return `${wonFormatter.format(rounded)}원`;
}

/**
 * "1일 구직급여일액"(`benefitDailyAmount`)을 화면에 표시할 때만 쓰는 절사(버림) 포맷터 —
 * **표시 전용**이며, 이 함수가 만드는 값을 계산에 재사용해서는 안 된다.
 *
 * FORMULA.md "정밀도/반올림 정책"(2026-09-02 갱신): logic.ts의 `benefitDailyAmount`는 이제
 * clamp까지만 적용한 완전정밀도 값이고, `totalExpectedBenefit`(logic.ts `finalizeTotalBenefit`)
 * 계산에도 그 완전정밀도 값이 그대로 쓰인다(work24.go.kr 실증, 검증 예제 7 —
 * `67,200.6원 × 240일 = 16,128,144원`이 실제 계산기 응답과 일치했다). 반면 화면에
 * "1일 구직급여일액"으로 보여주는 값은 사용자에게 소수점 있는 금액을 그대로 노출하지 않기
 * 위해 원 단위로 절사한다 — severance-pay가 "표시용=계산용"을 통일한 것과는 **반대 방향의
 * 결정**이다(severance-pay/formatting.ts 주석 참고). 두 계산기의 실제 라이브 서버 동작이
 * 서로 다르다는 것이 각각 확인됐을 뿐, 이 프로젝트가 "모든 계산기를 동일하게 통일해야 한다"는
 * 원칙을 채택한 적은 없다.
 *
 * 절사(버림) 방향 자체는 FORMULA.md가 여전히 "확인 필요"로 남긴 항목이다(work24.go.kr 응답에
 * "1일 지급액" 필드 자체가 노출되지 않아 직접 확인하지 못했다) — 사용자에게 불리하지 않은
 * 방향이라는 잠정 원칙만 채택했다.
 */
export function formatBenefitDailyAmountDisplay(amountWon: number): string {
  return formatWon(Math.floor(amountWon));
}

/**
 * 가입기간(일)을 "1,460일 (약 4년)" 형태로 사람이 읽기 쉬운 보조 표기와 함께 보여준다.
 * FORMULA.md "단위": "가입기간: 일(day) 단위로 내부 보관, 표시는 년/개월 등으로 변환 가능."
 * 내부 계산(365일=1년 환산, logic.ts DAYS_PER_YEAR_FOR_BAND)과 동일한 환산을 표시에도
 * 일관되게 적용한다 — 표시와 계산이 다른 환산 기준을 쓰면 사용자가 "왜 4.1년인데 3~5년
 * 구간이 아니라 1~3년 구간이지?" 같은 혼란을 겪을 수 있다.
 */
export function formatInsuredPeriodDays(days: number): string {
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  const months = Math.floor(remainingDays / 30);
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}년`);
  if (months > 0) parts.push(`${months}개월`);
  const approx = parts.length > 0 ? ` (약 ${parts.join(" ")})` : "";
  return `${formatDays(days)}${approx}`;
}
