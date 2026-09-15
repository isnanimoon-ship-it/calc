/**
 * 최저임금·시급↔월급 계산기 — 순수 계산 로직.
 *
 * tasks/minimum-wage-calculator/FORMULA.md "공식" / "계산 순서" / "정밀도·반올림 정책" 절을
 * 그대로 구현한다. 공식·반올림 정책을 이 파일에서 임의로 바꾸지 않는다.
 *
 * tasks/minimum-wage-calculator/ARCHITECTURE.md "8. 파일 구조 / 함수 분리"가 지정한 구조를
 * 그대로 따른다:
 *   calculateWeeklyPaidHours → calculateMonthlyEquivalentHoursExact/Hours →
 *   calculateFromHourlyWage / calculateFromMonthlyWage(모드별 완전 분리, 체이닝 금지 1차
 *   방어선, ARCHITECTURE.md "3.1") → calculateMinimumWageComparison(오케스트레이터, ui.tsx가
 *   호출하는 유일한 진입점).
 *
 * **주휴시간 산식은 반드시 `src/lib/labor-standards.ts`의 `calculateWeeklyHolidayHours`를
 * import해서 쓴다** — weekly-holiday-allowance와 공유하는 순수 함수이며, 이 파일에서
 * 로컬로 다시 구현하지 않는다(ARCHITECTURE.md "1.").
 *
 * **반올림 정책 [v2, FORMULA.md 개정]("정밀도/반올림 정책" — 이 계산기 고유의 명시적 예외)**:
 * `monthlyEquivalentHours`는 중간 계산 단계에서 이미 **소수 둘째 자리**로 반올림되고(v1의
 * 정수 반올림을 폐기 — 고용노동부 실시간 최저임금 모의계산기 `wageResultNew()`의
 * `toFixed(2)`와 동일한 정밀도), 이후 모든 계산(환산 시급/월급, 월 환산 최저임금)은 이
 * 반올림된 값을 그대로 재사용한다. 반올림 전 정밀값(`monthlyEquivalentHoursExact`)은 이
 * 파일의 지역 변수로만 존재하며 오케스트레이터의 반환값(`types.ts`)에는 절대 노출하지 않는다
 * (ARCHITECTURE.md "5. raw/display 분리") — Golden Test가 정밀값 자체를 검증하려면
 * `calculateMonthlyEquivalentHoursExact`를 직접 호출한다.
 *
 * `minWageMonthlyEquivalent`는 항상 이 호출의 실제 `weeklyHours`로 산출된
 * `monthlyEquivalentHours`를 곱해 매번 직접 계산한다 — 40시간 기준 209시간(2,156,880원)을
 * 상수로 하드코딩하지 않는다(ARCHITECTURE.md "6.", "7.", FORMULA.md 예제 C1·C2).
 */

import rates2026 from "@/src/data/rates-2026.json";
import { calculateWeeklyHolidayHours } from "@/src/lib/labor-standards";
import type {
  HourlyModeInput,
  HourlyModeResult,
  MinimumWageCalculatorInput,
  MinimumWageCalculatorResult,
  MonthlyModeInput,
  MonthlyModeResult,
} from "./types";

/**
 * 이 계산기가 적용하는 기준 연도. weekly-holiday-allowance/logic.ts와 동일한 패턴 —
 * 날짜 입력이 없어 `new Date().getFullYear()`로 런타임에 연도를 끌어낼 수 없으므로 상수로
 * 고정한다(ARCHITECTURE.md "11.").
 */
export const APPLICABLE_RATE_YEAR = 2026;

/** 연도별 데이터 파일 레지스트리. 현재는 rates-2026.json만 존재한다. */
const RATES_BY_YEAR: Record<number, typeof rates2026> = {
  2026: rates2026,
};

/** 적용 연도(`APPLICABLE_RATE_YEAR`)의 rates 파일을 조회한다. 없으면 조용히 폴백하지 않고 에러를 던진다. */
export function getApplicableRates(): typeof rates2026 {
  const ratesFile = RATES_BY_YEAR[APPLICABLE_RATE_YEAR];
  if (!ratesFile) {
    const availableYears = Object.keys(RATES_BY_YEAR).join(", ");
    throw new Error(
      `getApplicableRates: ${APPLICABLE_RATE_YEAR}년 데이터가 없습니다(사용 가능한 연도: ${availableYears}).`,
    );
  }
  return ratesFile;
}

/** `calculateWeeklyPaidHours`의 반환 타입. */
export interface WeeklyPaidHoursCalculation {
  /** 1주 유급주휴시간. 반올림하지 않는다. */
  weeklyHolidayHours: number;
  /** "1주의 최저임금 적용기준 시간 수"(최저임금법 시행령 제5조제2호) = weeklyHours + weeklyHolidayHours. */
  weeklyPaidHours: number;
  /** `weeklyHours > statutoryWeeklyHours`라 주휴시간이 8시간 상한에 걸렸는지 여부. */
  cappedAtStatutoryLimit: boolean;
}

/**
 * FORMULA.md "계산 순서" 2~3단계 — 1주 주휴시간과 1주 최저임금 적용기준 시간 수를 산출한다.
 * 주휴시간 산식 자체는 `src/lib/labor-standards.ts`의 `calculateWeeklyHolidayHours`를 그대로
 * 호출한다(로컬 재구현 금지, ARCHITECTURE.md "1.").
 */
export function calculateWeeklyPaidHours(
  weeklyHours: number,
  statutoryWeeklyHours: number,
  statutoryDailyHours: number,
): WeeklyPaidHoursCalculation {
  const weeklyHolidayHours = calculateWeeklyHolidayHours(
    weeklyHours,
    statutoryWeeklyHours,
    statutoryDailyHours,
  );
  return {
    weeklyHolidayHours,
    weeklyPaidHours: weeklyHours + weeklyHolidayHours,
    cappedAtStatutoryLimit: weeklyHours > statutoryWeeklyHours,
  };
}

/** `rates-{year}.json`의 `laborStandards.monthlyWeekFactor.value` 그대로의 모양. */
export interface MonthlyWeekFactor {
  daysPerYear: number;
  monthsPerYear: number;
  daysPerWeek: number;
}

/**
 * FORMULA.md "계산 순서" 4단계 — "1개월의 최저임금 적용기준 시간 수"(정밀값, 시행령 제5조제3호).
 * `weeklyPaidHours * daysPerYear / (monthsPerYear * daysPerWeek)`(= × 365/84). 나눗셈은
 * 곱셈 뒤 마지막에 1회만 수행한다(중간 반올림 금지).
 *
 * 오케스트레이터의 반환값 조립에는 관여하지 않는다(ARCHITECTURE.md "5.3") — Golden Test가
 * 정밀값(예: 208.571...) 자체를 검증할 때만 직접 호출하는 독립 헬퍼다.
 */
export function calculateMonthlyEquivalentHoursExact(
  weeklyPaidHours: number,
  monthlyWeekFactor: MonthlyWeekFactor,
): number {
  const { daysPerYear, monthsPerYear, daysPerWeek } = monthlyWeekFactor;
  return (weeklyPaidHours * daysPerYear) / (monthsPerYear * daysPerWeek);
}

/**
 * 소수 둘째 자리 반올림(사사오입) — 고용노동부 최저임금 모의계산기(`moel.go.kr`
 * `wageResultNew()`)가 쓰는 `toFixed(2)`와 동일한 결과를 내는 계산 방식이다
 * (`Number(x.toFixed(2))`는 문자열 변환을 거쳐 결과가 미묘하게 달라질 수 있는 극단적
 * 경계값이 있을 수 있어 배제했다 — ARCHITECTURE.md "v2 개정 > 3." 참고, 이 계산기의
 * `weeklyHours` 유효 범위(1~168)에서는 실질적 차이가 없다).
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * FORMULA.md "계산 순서" 5단계 — 월 환산 시간(표시·계산 공용값) =
 * `round2(monthlyEquivalentHoursExact)`.
 *
 * **[v2, FORMULA.md 개정]** v1은 `Math.round(...)`(정수, 예: `209`)였으나, 고용노동부
 * 실시간 최저임금 판정 도구(`moel.go.kr` `wageResultNew()`)가 정수 반올림을 쓰지 않고
 * 소수 둘째 자리(`toFixed(2)`)까지만 유지한 채 실제 판정을 계산한다는 것이 Calculation
 * Auditor의 코드 확인으로 밝혀져(EVALUATION.md "우선순위 항목 2"), FORMULA.md가 이 반올림
 * 자릿수를 정수에서 소수 둘째 자리로 교체했다(FORMULA.md "정밀도/반올림 정책 [v2]"). `weeklyHours=40`
 * 이면 이제 `208.57`을 반환한다(과거 `209`가 아니다).
 *
 * 이 함수 고유의 중간 반올림 정책은 여전히 `docs/CALCULATOR_RULES.md` 일반 원칙("중간 계산은
 * 반올림하지 않는다")의 명시적 예외다 — 바뀐 것은 반올림 "자릿수"뿐이고, 이 함수의 반환값을
 * 이후 모든 계산(환산 시급/월급, 월 환산 최저임금)이 그대로 재사용한다는 원칙 자체는 v1과
 * 동일하다.
 */
export function calculateMonthlyEquivalentHours(
  weeklyPaidHours: number,
  monthlyWeekFactor: MonthlyWeekFactor,
): number {
  return round2(calculateMonthlyEquivalentHoursExact(weeklyPaidHours, monthlyWeekFactor));
}

/**
 * `calculateFromHourlyWage`/`calculateFromMonthlyWage`가 공유하는 공통 계산 조각 —
 * FORMULA.md "계산 순서" 2~5, 7단계(주휴시간·월 환산 시간·최저임금 조회)를 한 번에 묶는다.
 * `mode`별로 갈라지는 부분(환산값 산출, display*, meets* 판정)은 각 함수가 직접 조립한다.
 *
 * `minWageMonthlyEquivalent`는 이 호출의 `weeklyHours`로 산출된 `monthlyEquivalentHours`를
 * 곱해 매번 새로 계산한다(ARCHITECTURE.md "6.", "7." — 참고 상수를 저장해 두고 재사용하지
 * 않는다. `rates-2026.json`에 40시간 기준 고정값을 추가하지 않기로 한 결정과 짝을 이룬다).
 *
 * **[v2, FORMULA.md 개정] `minWageMonthlyEquivalent`의 `Math.round(...)`가 이제 실질적인
 * 연산이다.** v1은 `monthlyEquivalentHours`가 항상 정수라 `minWageHourly *
 * monthlyEquivalentHours`가 이미 정수였으므로 반올림 호출이 사실상 무연산(no-op)이었다
 * (ARCHITECTURE.md "v2 개정 > 3."). v2는 `monthlyEquivalentHours`가 소수 둘째 자리 값이라
 * 이 곱이 대부분 소수로 떨어지므로(예: `10,320 × 208.57 = 2,152,442.4`), 원 단위 사사오입을
 * 반드시 명시적으로 적용해야 한다 — 이 반올림을 빠뜨리면 원 단위 금액 필드가 소수를 갖게 되는
 * 표시 오류가 난다.
 */
function computeSharedComparison(weeklyHours: number, rates: typeof rates2026) {
  const statutoryWeeklyHours = rates.laborStandards.statutoryWeeklyHours.value; // 40
  const statutoryDailyHours = rates.laborStandards.statutoryDailyHours.value; // 8
  const monthlyWeekFactor = rates.laborStandards.monthlyWeekFactor.value; // 365/12/7

  const { weeklyHolidayHours, weeklyPaidHours, cappedAtStatutoryLimit } =
    calculateWeeklyPaidHours(weeklyHours, statutoryWeeklyHours, statutoryDailyHours);

  const monthlyEquivalentHours = calculateMonthlyEquivalentHours(weeklyPaidHours, monthlyWeekFactor);

  const minWageHourly = rates.minimumWage.hourly.value;
  const minWageMonthlyEquivalent = Math.round(minWageHourly * monthlyEquivalentHours);

  return {
    weeklyHours,
    weeklyHolidayHours,
    weeklyPaidHours,
    monthlyEquivalentHours,
    cappedAtStatutoryLimit,
    minWageHourly,
    minWageMonthlyEquivalent,
  };
}

/**
 * 시급 모드 전용 계산 함수. **월급 → 시급 방향(반대 방향)을 계산할 수 있는 코드 경로가 이
 * 함수 안에 존재하지 않는다** — ARCHITECTURE.md "3.1" 체이닝 금지 1차 방어선.
 *
 * 입력은 validation.ts를 통과했다는 전제다 — 이 함수 자체는 방어적 재검증(음수·형식 등)을
 * 반복하지 않는다(관심사 분리). 단, FORMULA.md 예제 E1(소수 시급)처럼 validation.ts가
 * 정수만 허용해 걸러내는 값도 이 함수 자체는 정상 계산해야 한다
 * (ARCHITECTURE.md "10." — logic.ts는 공식이 수학적으로 처리 가능한 입력이면 그대로 계산한다).
 */
export function calculateFromHourlyWage(input: HourlyModeInput): HourlyModeResult {
  const rates = getApplicableRates();
  const shared = computeSharedComparison(input.weeklyHours, rates);

  // 6단계 — 환산값 산출(최종 표시 반올림 1회, FORMULA.md "최종 표시 반올림").
  const convertedMonthlyPay = Math.round(input.hourlyWage * shared.monthlyEquivalentHours);

  const displayHourlyWage = input.hourlyWage;
  const displayMonthlyPay = convertedMonthlyPay;

  const hourlyMeetsMinimumWage = displayHourlyWage >= shared.minWageHourly;
  const monthlyMeetsMinimumWage = displayMonthlyPay >= shared.minWageMonthlyEquivalent;

  return {
    ...shared,
    mode: "HOURLY",
    displayHourlyWage,
    displayMonthlyPay,
    convertedMonthlyPay,
    hourlyMeetsMinimumWage,
    monthlyMeetsMinimumWage,
    // [v2 신규] types.ts "minimumWageJudgmentMismatch" 참고 — 두 판정을 실제로 비교해서
    // 계산한다(HOURLY 모드에서는 수학적으로 항상 false이지만 상수로 하드코딩하지 않는다).
    minimumWageJudgmentMismatch: hourlyMeetsMinimumWage !== monthlyMeetsMinimumWage,
    appliedRateYear: APPLICABLE_RATE_YEAR,
  };
}

/**
 * 월급 모드 전용 계산 함수. **시급 → 월급 방향(반대 방향)을 계산할 수 있는 코드 경로가 이
 * 함수 안에 존재하지 않는다** — ARCHITECTURE.md "3.1" 체이닝 금지 1차 방어선.
 */
export function calculateFromMonthlyWage(input: MonthlyModeInput): MonthlyModeResult {
  const rates = getApplicableRates();
  const shared = computeSharedComparison(input.weeklyHours, rates);

  // 6단계 — 환산값 산출(최종 표시 반올림 1회).
  const convertedHourlyWage = Math.round(input.monthlyWage / shared.monthlyEquivalentHours);

  const displayMonthlyPay = input.monthlyWage;
  const displayHourlyWage = convertedHourlyWage;

  const hourlyMeetsMinimumWage = displayHourlyWage >= shared.minWageHourly;
  const monthlyMeetsMinimumWage = displayMonthlyPay >= shared.minWageMonthlyEquivalent;

  return {
    ...shared,
    mode: "MONTHLY",
    displayHourlyWage,
    displayMonthlyPay,
    convertedHourlyWage,
    hourlyMeetsMinimumWage,
    monthlyMeetsMinimumWage,
    // [v2 신규] MONTHLY 모드는 원 단위 반올림 손실 때문에 이 값이 실제로 true가 될 수 있는
    // 유일한 분기다(FORMULA.md v2 "[신규] Calculation Auditor 항목 6..." 절, 반례 구간 폭
    // 약 M/2). 하드코딩하지 않고 항상 두 판정을 실제로 비교한다.
    minimumWageJudgmentMismatch: hourlyMeetsMinimumWage !== monthlyMeetsMinimumWage,
    appliedRateYear: APPLICABLE_RATE_YEAR,
  };
}

/**
 * 오케스트레이터 — `ui.tsx`가 호출하는 유일한 진입점(ARCHITECTURE.md "3.1"). `mode`에 따라
 * 위 두 함수 중 정확히 하나만 호출한다. 이 함수 자체에도 반대 방향을 계산하는 코드가 없다 —
 * 단순히 어느 전용 함수를 호출할지 분기할 뿐이다.
 */
export function calculateMinimumWageComparison(
  input: MinimumWageCalculatorInput,
): MinimumWageCalculatorResult {
  return input.mode === "HOURLY"
    ? calculateFromHourlyWage(input)
    : calculateFromMonthlyWage(input);
}
