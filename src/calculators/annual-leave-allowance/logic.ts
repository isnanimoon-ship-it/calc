/**
 * 연차수당 계산기 — 순수 계산 로직.
 *
 * tasks/annual-leave-allowance/FORMULA.md "공식" / "계산 순서" / "정밀도·반올림 정책" 절을
 * 그대로 구현한다. 공식·반올림 정책을 이 파일에서 임의로 바꾸지 않는다.
 *
 * tasks/annual-leave-allowance/ARCHITECTURE.md "9."가 지정한 5+1 함수 구조를 그대로 따른다:
 * determineContinuousServiceRegime → calculateAccruedDays → calculateUnusedDays →
 * calculateAllowance(선택) → calculateMinimumWageReference(선택) →
 * calculateAnnualLeaveAllowance(오케스트레이터). 날짜 산술(monthAnniversary/yearAnniversary/
 * completedMonths/completedYears)은 date-utils.ts로 분리되어 있다 — 이 파일은 그 결과값만
 * 받아 도메인 판정(3구간, 가산 연차, 미사용일수, 금액)만 담당한다.
 *
 * `policy.ts`는 만들지 않는다(ARCHITECTURE.md "7.") — 11/15/25/2(년)는 근로기준법 조문이
 * 직접 정한 고정 법정 상수(매년 갱신되는 고시값이 아님)라 이 파일 로컬 `const`로 둔다.
 * 최저임금 시급·소정근로시간만 `rates-2026.json` 최상위 필드를 그대로 읽는다(신규 정책
 * 데이터 없음).
 */

import { parseIsoDateUtc } from "@/src/lib/date-calc";
import rates2026 from "@/src/data/rates-2026.json";
import {
  completedMonths as completedMonthsBetween,
  completedYears as completedYearsBetween,
} from "./date-utils";
import type {
  AccrualBreakdownDetail,
  AnnualLeaveAllowanceInput,
  AnnualLeaveAllowanceResult,
  ContinuousServiceRegime,
  MinimumWageReferenceDetail,
  UnusedLeaveAllowanceDetail,
  Won,
} from "./types";

/** 근로기준법 제60조②: 계속근로기간 1년 미만 구간의 최대 발생일수. */
export const UNDER_ONE_YEAR_MAX_DAYS = 11;
/** 근로기준법 제60조①: 1년 시점 기본 발생일수(80% 이상 출근 시). */
export const FIRST_YEAR_GRANT_DAYS = 15;
/**
 * 근속 1년 이상 2년 미만 구간의 고정 발생일수 = 11(1년 미만 상한) + 15(1년 시점 발생).
 * 근로기준법 제60조③ 삭제(2017.11.28 법률 제17185호, 2018.5.29 시행) 효과 —
 * FORMULA.md "왜 구간 2에서만 26인가" 참고. 조건 없는 고정 상수 합이다.
 */
export const YEAR_1_TO_2_ACCRUED_DAYS = 26;
/** 근로기준법 제60조④: 가산휴가를 포함한 총 휴가 일수의 상한. */
export const MAX_ACCRUED_DAYS = 25;
/** 근로기준법 제60조④: "매 2년"마다 1일 가산. */
export const ACCRUAL_INTERVAL_YEARS = 2;

/** 연도별 최저임금 참고 데이터 레지스트리. 현재는 rates-2026.json만 존재한다. */
const RATES_BY_YEAR: Record<number, typeof rates2026> = {
  2026: rates2026,
};

/**
 * ARCHITECTURE.md "6." — 이 필드에 한해서는 severance-pay/unemployment-benefit의 "연도
 * 데이터가 없으면 throw" 정책을 따르지 않는다. 최저임금 참고 경고는 Should Have·비차단
 * 기능이라, 데이터가 없는 연도(예: 아직 rates 파일이 없는 미래 연도)를 조회해도 에러를
 * 던지지 않고 조용히 undefined를 반환해 Should Have만 생략한다(Must Have 계산은 항상 완주).
 */
function getRatesForYearOrNull(year: number): typeof rates2026 | null {
  return RATES_BY_YEAR[year] ?? null;
}

/** `determineContinuousServiceRegime`의 반환 타입. */
export interface ContinuousServiceRegimeDetermination {
  continuousServiceRegime: ContinuousServiceRegime;
  completedYears: number;
}

/**
 * FORMULA.md "계산 순서" 2단계 — `completedYears(hireDate, referenceDate)`로 3구간 중
 * 하나를 판정한다. date-utils.ts의 `completedYears`만 호출하고 그 외 로직이 없다 —
 * Calculation Auditor가 이 함수 하나만으로 구간 경계값(정확히 1년/2년 등)을 검증할 수 있다.
 */
export function determineContinuousServiceRegime(
  hireDate: Date,
  referenceDate: Date,
): ContinuousServiceRegimeDetermination {
  const years = completedYearsBetween(hireDate, referenceDate);
  const continuousServiceRegime: ContinuousServiceRegime =
    years === 0 ? "UNDER_1YEAR" : years === 1 ? "YEAR_1_TO_2" : "OVER_2YEARS";
  return { continuousServiceRegime, completedYears: years };
}

/**
 * `calculateAccruedDays`의 반환 타입 — `types.ts`의 판별 유니온 중 "구간별 추가 필드 +
 * accruedDays" 부분만을 그대로 반영한다(공통 base 필드는 오케스트레이터가 나중에 합친다).
 */
export type AccrualCalculation =
  | { continuousServiceRegime: "UNDER_1YEAR"; completedMonths: number; accruedDays: number }
  | { continuousServiceRegime: "YEAR_1_TO_2"; accruedDays: 26 }
  | {
      continuousServiceRegime: "OVER_2YEARS";
      accrualBreakdown: AccrualBreakdownDetail;
      accruedDays: number;
    };

/**
 * FORMULA.md "연차 발생일수(accruedDays) 정의" 3구간 + "가산 연차(yearlyGrant) 계산 근거"를
 * 그대로 구현한다.
 *
 * ```
 * [UNDER_1YEAR]  accruedDays = min(completedMonths, 11)
 * [YEAR_1_TO_2]  accruedDays = 11 + 15 = 26 (고정)
 * [OVER_2YEARS]  yearlyGrant(N) = min(15 + floor((N-1)/2), 25)
 * ```
 */
export function calculateAccruedDays(
  regime: ContinuousServiceRegime,
  completedMonthsValue: number,
  completedYearsValue: number,
): AccrualCalculation {
  if (regime === "UNDER_1YEAR") {
    const accruedDays = Math.min(completedMonthsValue, UNDER_ONE_YEAR_MAX_DAYS);
    return {
      continuousServiceRegime: "UNDER_1YEAR",
      completedMonths: completedMonthsValue,
      accruedDays,
    };
  }

  if (regime === "YEAR_1_TO_2") {
    return { continuousServiceRegime: "YEAR_1_TO_2", accruedDays: YEAR_1_TO_2_ACCRUED_DAYS };
  }

  // OVER_2YEARS — "최초 1년을 초과하는 계속 근로 연수"(N-1) 매 2년마다 1일 가산, 25일 상한.
  const addedDays = Math.floor((completedYearsValue - 1) / ACCRUAL_INTERVAL_YEARS);
  const rawTotalDays = FIRST_YEAR_GRANT_DAYS + addedDays;
  const accruedDays = Math.min(rawTotalDays, MAX_ACCRUED_DAYS);
  const accrualBreakdown: AccrualBreakdownDetail = {
    baseDays: FIRST_YEAR_GRANT_DAYS,
    addedDays,
    rawTotalDays,
    cappedAtMax: rawTotalDays > MAX_ACCRUED_DAYS,
  };
  return { continuousServiceRegime: "OVER_2YEARS", accrualBreakdown, accruedDays };
}

export interface UnusedDaysCalculation {
  unusedDays: number;
  usedMoreThanAccruedWarning: boolean;
}

/**
 * FORMULA.md "계산 순서" 4단계 — `unusedDays = max(accruedDays - usedDays, 0)`.
 * `usedDays > accruedDays`면 `usedMoreThanAccruedWarning = true`로 설정하되 계산은 계속
 * 진행한다(오류로 막지 않는다, SPEC.md Must Have).
 */
export function calculateUnusedDays(accruedDays: number, usedDays: number): UnusedDaysCalculation {
  return {
    unusedDays: Math.max(accruedDays - usedDays, 0),
    usedMoreThanAccruedWarning: usedDays > accruedDays,
  };
}

/**
 * FORMULA.md "계산 순서" 5단계(선택) — `ordinaryDailyWage`가 입력된 경우에만 오케스트레이터가
 * 호출한다. `unusedLeaveAllowance = round(unusedDays × ordinaryDailyWage)`, 원 단위 사사오입
 * 최종 1회(ARCHITECTURE.md "3." — 절사 전 완전정밀도 곱은 이 함수 스코프 안의 지역 변수로만
 * 존재하고 반환 타입에 노출하지 않는다).
 */
export function calculateAllowance(unusedDays: number, ordinaryDailyWage: Won): UnusedLeaveAllowanceDetail {
  const unusedLeaveAllowanceRaw = unusedDays * ordinaryDailyWage;
  return {
    ordinaryDailyWage,
    unusedLeaveAllowance: Math.round(unusedLeaveAllowanceRaw),
  };
}

/**
 * FORMULA.md "계산 순서" 6단계(선택, Should Have) — `referenceDate`의 연도로
 * `rates-{year}.json`을 조회해 최저임금×소정근로시간 환산액과 비교한다. 해당 연도 데이터가
 * 없으면 `undefined`를 반환한다(에러를 던지지 않는다 — 위 "6." 근거).
 */
export function calculateMinimumWageReference(
  ordinaryDailyWage: Won,
  referenceDate: Date,
): MinimumWageReferenceDetail | undefined {
  const year = referenceDate.getUTCFullYear();
  const rates = getRatesForYearOrNull(year);
  if (!rates) return undefined;

  const dailyReferenceAmount =
    rates.minimumWage.hourly.value * rates.laborStandards.statutoryDailyHours.value;

  return {
    year,
    dailyReferenceAmount,
    belowMinimumWageReference: ordinaryDailyWage < dailyReferenceAmount,
  };
}

/**
 * 오케스트레이터 — 위 함수들을 FORMULA.md "계산 순서" 그대로 호출해 판별 유니온을 조립한다.
 *
 * 입력은 validation.ts(`validateAnnualLeaveAllowanceInput`)를 통과했다는 전제다 — 이 함수
 * 자체는 방어적 재검증(날짜 순서, 음수 등)을 반복하지 않는다(관심사 분리).
 */
export function calculateAnnualLeaveAllowance(
  input: AnnualLeaveAllowanceInput,
): AnnualLeaveAllowanceResult {
  const hireDate = parseIsoDateUtc(input.hireDate);
  const referenceDate = parseIsoDateUtc(input.referenceDate);
  if (!hireDate || !referenceDate) {
    throw new Error(
      `calculateAnnualLeaveAllowance: 유효하지 않은 날짜 문자열입니다(hireDate=${input.hireDate}, referenceDate=${input.referenceDate}). validation.ts를 통과한 입력만 전달해야 합니다.`,
    );
  }

  // 1~2단계: 근속 구간 판정.
  const { continuousServiceRegime, completedYears } = determineContinuousServiceRegime(
    hireDate,
    referenceDate,
  );
  // completedMonths는 UNDER_1YEAR 구간에서만 의미가 있다(FORMULA.md 출력값 표) — 그 외
  // 구간에서는 계산할 필요가 없다.
  const completedMonthsValue =
    continuousServiceRegime === "UNDER_1YEAR"
      ? completedMonthsBetween(hireDate, referenceDate)
      : 0;

  // 3단계: 발생일수 산출.
  const accrual = calculateAccruedDays(continuousServiceRegime, completedMonthsValue, completedYears);

  // 4단계: 미사용일수 산출.
  const usedDays = input.usedDays ?? 0;
  const { unusedDays, usedMoreThanAccruedWarning } = calculateUnusedDays(accrual.accruedDays, usedDays);

  // 5~6단계(선택): 1일 통상임금을 입력한 경우에만 금액·최저임금 참고 경고를 계산한다.
  const allowance =
    input.ordinaryDailyWage != null
      ? calculateAllowance(unusedDays, input.ordinaryDailyWage)
      : undefined;
  const minimumWageReference =
    input.ordinaryDailyWage != null
      ? calculateMinimumWageReference(input.ordinaryDailyWage, referenceDate)
      : undefined;

  const base = {
    completedYears,
    accruedDays: accrual.accruedDays,
    usedDays,
    unusedDays,
    usedMoreThanAccruedWarning,
    allowance,
    minimumWageReference,
  };

  // 8단계: 결과 조립 — types.ts의 3-way discriminated union 그대로.
  if (accrual.continuousServiceRegime === "UNDER_1YEAR") {
    return {
      ...base,
      continuousServiceRegime: "UNDER_1YEAR",
      completedMonths: accrual.completedMonths,
    };
  }
  if (accrual.continuousServiceRegime === "YEAR_1_TO_2") {
    return { ...base, continuousServiceRegime: "YEAR_1_TO_2", accruedDays: accrual.accruedDays };
  }
  return {
    ...base,
    continuousServiceRegime: "OVER_2YEARS",
    accrualBreakdown: accrual.accrualBreakdown,
  };
}
