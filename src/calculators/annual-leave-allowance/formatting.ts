/**
 * 연차수당 계산기 — 표시용 포맷팅 + "계산 근거" 단계별 문자열 조립.
 *
 * docs/CALCULATOR_RULES.md "금액/숫자 연산": 화면 표시는 Intl.NumberFormat('ko-KR')로
 * 통일한다. logic.ts는 숫자만 반환하고, 사람이 읽는 문장(계산 근거 breakdown)은 이 파일이
 * 조립한다(bmr-calculator/formatting.ts, housing-acquisition-tax/formatting.ts와 동일한
 * 관례) — logic.ts의 판정을 다시 구현하지 않고, 이미 계산된 값만 조합한다.
 */

import type {
  AccrualBreakdownDetail,
  ContinuousServiceRegime,
  MinimumWageReferenceDetail,
  Won,
} from "./types";

const numberFormatter = new Intl.NumberFormat("ko-KR");

/** 정수 원 금액을 "1,300,000원" 형태로 표시한다. */
export function formatWon(amountWon: Won): string {
  return `${numberFormatter.format(Math.round(amountWon))}원`;
}

/** 일수를 "26일"/"11.5일"(반차 등 소수 입력 허용) 형태로 표시한다. */
export function formatDays(days: number): string {
  return `${numberFormatter.format(days)}일`;
}

/** 개월수를 "6개월" 형태로 표시한다. */
export function formatMonths(months: number): string {
  return `${numberFormatter.format(months)}개월`;
}

/** 근속연수를 "3년" 형태로 표시한다. */
export function formatYears(years: number): string {
  return `${numberFormatter.format(years)}년`;
}

/** `continuousServiceRegime` 3구간의 일상어 라벨(SPEC.md "라벨 표현" — 법령 용어 대신 사용). */
export const CONTINUOUS_SERVICE_REGIME_LABELS: Record<ContinuousServiceRegime, string> = {
  UNDER_1YEAR: "입사 1년 미만",
  YEAR_1_TO_2: "입사 1년 이상 2년 미만",
  OVER_2YEARS: "입사 2년 이상",
};

/**
 * 1단계 — 근속기간 판정 breakdown 문장.
 * `completedMonths`는 `UNDER_1YEAR` 구간일 때만 전달한다(그 외 구간은 생략).
 */
export function buildServicePeriodBreakdown(params: {
  hireDate: string;
  referenceDate: string;
  completedYears: number;
  completedMonths?: number;
  regime: ContinuousServiceRegime;
}): string {
  const { hireDate, referenceDate, completedYears, completedMonths, regime } = params;
  const durationText =
    completedMonths != null
      ? `${formatYears(completedYears)} ${formatMonths(completedMonths)}`
      : formatYears(completedYears);
  return `입사일 ${hireDate} ~ 기준일 ${referenceDate} → 근속 ${durationText} (${CONTINUOUS_SERVICE_REGIME_LABELS[regime]})`;
}

/** 2단계(UNDER_1YEAR) — 1년 미만 구간 발생일수 breakdown. */
export function buildUnder1YearAccrualBreakdown(completedMonths: number, accruedDays: number): string {
  return `개근 ${formatMonths(completedMonths)} → 발생일수 min(${completedMonths}, 11) = ${formatDays(accruedDays)}`;
}

/** 2단계(YEAR_1_TO_2) — 1~2년차 구간(26일 고정) breakdown. */
export function buildYear1To2AccrualBreakdown(accruedDays: number): string {
  return `1년 미만 발생 최대 11일 + 1년 시점 발생 15일 = ${formatDays(accruedDays)}`;
}

/** 2단계(OVER_2YEARS) — 2년 이상 구간(가산 연차) breakdown. */
export function buildOver2YearsAccrualBreakdown(
  completedYears: number,
  breakdown: AccrualBreakdownDetail,
  accruedDays: number,
): string {
  const capText = breakdown.cappedAtMax ? " → 25일 상한 적용" : "";
  return (
    `근속 ${formatYears(completedYears)}차 → 기본 ${breakdown.baseDays}일 + 가산 ${breakdown.addedDays}일 ` +
    `= ${breakdown.rawTotalDays}일${capText} → ${formatDays(accruedDays)}`
  );
}

/** 3단계 — 미사용일수 breakdown. */
export function buildUnusedDaysBreakdown(accruedDays: number, usedDays: number, unusedDays: number): string {
  return `발생일수 ${formatDays(accruedDays)} - 사용일수 ${formatDays(usedDays)} = 미사용일수 ${formatDays(unusedDays)}`;
}

/** 4단계 — 미사용 연차수당 breakdown(`allowance`가 있을 때만 호출). */
export function buildAllowanceBreakdown(
  unusedDays: number,
  ordinaryDailyWage: Won,
  unusedLeaveAllowance: Won,
): string {
  return `미사용일수 ${formatDays(unusedDays)} × 1일 통상임금 ${formatWon(ordinaryDailyWage)} = ${formatWon(unusedLeaveAllowance)}`;
}

/**
 * 최저임금 참고 경고 문장(`belowMinimumWageReference === true`일 때만 노출).
 * FORMULA.md 검증 예제 16 문구("...최저임금 기준(하루 8시간 근무 시 82,560원)보다
 * 낮습니다")와 같은 취지이되, "8시간"은 `MinimumWageReferenceDetail`이 별도 필드로 갖고
 * 있지 않으므로("하루 소정근로시간 기준"이라는 일반 표현으로) 특정 시간 숫자를 하드코딩하지
 * 않는다 — 시간 값이 바뀌어도 이 문구는 조용히 틀리지 않는다.
 */
export function buildBelowMinimumWageWarning(reference: MinimumWageReferenceDetail): string {
  return (
    `입력한 1일 통상임금이 ${reference.year}년 최저임금 기준(하루 소정근로시간 기준 ` +
    `${formatWon(reference.dailyReferenceAmount)})보다 낮습니다.`
  );
}

/**
 * "사용일수가 발생일수보다 많습니다" 인라인 경고 문구(FORMULA.md "예외" 그대로 + UX/UI
 * Critic High 권고 반영). 발생일수는 누적 총량이 아니라 가장 최근 발생분 기준이라는 점을
 * 짧게 덧붙여, 근속 2년 이상 사용자가 누적 사용일수를 잘못 입력해 이 경고를 보게 됐을 때
 * 원인을 스스로 짚어볼 수 있게 한다.
 */
export const USED_MORE_THAN_ACCRUED_WARNING_TEXT =
  "입력한 사용일수가 발생일수보다 많습니다. 미사용일수는 0일로 계산합니다. 발생일수는 입사 후 누적 총 사용일수가 아니라 가장 최근 발생분 기준이니, 혹시 누적 사용일수를 입력하지 않았는지 확인해보세요.";
