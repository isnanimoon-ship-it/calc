/**
 * 주휴수당 계산기 — 순수 계산 로직.
 *
 * ⚠️ 현재는 Architect 스캐폴딩 단계다 — 아래 `calculateWeeklyHolidayAllowance`의 본문은
 * Builder가 tasks/weekly-holiday-allowance/FORMULA.md "공식" / "계산 순서" / "정밀도·반올림
 * 정책"을 그대로 구현한다. 공식·반올림 정책을 이 파일에서 임의로 바꾸지 않는다.
 *
 * Architect가 여기서 확정한 것(스텁이 아니라 구조 결정):
 * - **적용 연도 선택**: `APPLICABLE_RATE_YEAR` 상수(아래). `new Date().getFullYear()` 런타임
 *   방식은 쓰지 않는다 — 2027-01-01에 rates-2027.json이 없으면 깨진다
 *   (ARCHITECTURE.md "적용 연도 선택 로직").
 * - **데이터 바인딩**: `getApplicableRates()`가 연도별 rates 파일을 조회한다. 이 계산기가
 *   읽는 값은 (1) `minimumWage.hourly.value` (최저임금 경고), (2) `laborStandards`의
 *   `statutoryWeeklyHours`(40) / `statutoryDailyHours`(8) / `ultraShortTimeWeeklyHours`(15) /
 *   `monthlyWeekFactor`(365·12·7) 뿐이다 — 40/8/15/월환산계수는 계산기 코드에 하드코딩하지
 *   않고 반드시 이 데이터 파일에서 읽는다(docs/ARCHITECTURE.md "공용 데이터").
 * - **정밀도 전략**: JS `Number`(전 단위 스케일링·BigInt·decimal 없음). 금액 필드는 반올림
 *   없이 완전정밀도로 반환하고, 원 단위 반올림은 formatting.ts의 `roundWon`이 표시 직전에만
 *   1회 적용한다 — 반올림된 값을 다른 계산에 재사용하지 않는다는 정책을 구조로 강제한다.
 * - **월 환산**: `× 365 ÷ 84`(= × 365 ÷ 12 ÷ 7). 나눗셈은 곱셈을 모두 마친 뒤 마지막에 1회.
 */

import rates2026 from "@/src/data/rates-2026.json";
import type {
  WeeklyHolidayAllowanceInput,
  WeeklyHolidayAllowanceResult,
} from "./types";

/**
 * 이 계산기가 적용하는 기준 연도.
 *
 * severance-pay / unemployment-benefit은 `retireDate` / `leaveDate` 같은 날짜 입력에서 연도를
 * 뽑아 `rates-{year}.json`을 고른다. 주휴수당 계산기는 날짜 입력이 없어 그럴 수 없으므로
 * 적용 연도를 명시적 상수로 고정한다. `new Date().getFullYear()`는 쓰지 않는다 —
 * 2027-01-01이 되면 (아직 rates-2027.json이 없을 때) 런타임에 데이터 조회가 실패한다.
 *
 * ▶ rates-2027.json이 준비되면(2027년 최저임금 10,700원은 이미 고시됐으나, 검증된 다른
 *   필드까지 담은 파일 생성은 Formula Analyst 확인 후 진행) 이 상수와 아래 import·RATES_BY_YEAR
 *   맵을 함께 올린다. 이 한 곳만 고치면 된다.
 */
export const APPLICABLE_RATE_YEAR = 2026;

/**
 * 연도별 데이터 파일 레지스트리. 현재는 rates-2026.json만 존재한다.
 * unemployment-benefit/logic.ts의 `RATES_BY_YEAR`와 같은 패턴이다.
 */
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

/**
 * 주휴수당 계산 메인 함수. FORMULA.md "공식" 1~10단계 / "계산 순서" 1~10단계를 구현한다.
 *
 * 입력은 validation.ts(`validateWeeklyHolidayAllowanceInput`)를 통과했다는 전제다 — 이 함수는
 * 방어적 재검증(음수·형식 등)을 반복하지 않는다(관심사 분리).
 *
 * FORMULA.md "공식" 1~9단계:
 *   1. weeklyHolidayHours = min(weeklyHours / statutoryWeeklyHours * statutoryDailyHours, statutoryDailyHours)
 *   2. weeklyHolidayPay   = weeklyHolidayHours * hourlyWage            (반올림 없음)
 *   3. monthlyHolidayPay  = weeklyHolidayPay * daysPerYear / (monthsPerYear * daysPerWeek)
 *   4. weeklyTotalPay     = weeklyHours * hourlyWage + weeklyHolidayPay
 *   5. monthlyTotalPay    = weeklyTotalPay * daysPerYear / (monthsPerYear * daysPerWeek)
 *   6. effectiveHourlyWage = weeklyTotalPay / weeklyHours
 *   7. meetsMinHoursRequirement = weeklyHours >= ultraShortTimeWeeklyHours
 *   8. belowMinimumWage = hourlyWage < minimumWage.hourly.value
 *   9. cappedAtStatutoryLimit = weeklyHours > statutoryWeeklyHours
 *
 * 반올림 정책(FORMULA.md "정밀도/반올림 정책", ARCHITECTURE.md "숫자 정밀도 전략"):
 * - 금액 필드(weeklyHolidayPay/monthlyHolidayPay/weeklyTotalPay/monthlyTotalPay/effectiveHourlyWage)와
 *   weeklyHolidayHours는 **완전정밀도(반올림 전)** 로 반환한다. 원 단위 반올림은 formatting.ts의
 *   `roundWon`이 표시 직전에만 각 값에 독립적으로 1회 적용한다.
 * - 월 환산 `× daysPerYear ÷ (monthsPerYear * daysPerWeek)`(= × 365 ÷ 84)는 곱셈을 먼저 하고
 *   나눗셈을 마지막에 1회만 수행한다. `4.345`로 미리 반올림한 계수를 쓰지 않는다.
 * - 40/8/15/월환산계수(365·12·7)는 계산기 코드에 하드코딩하지 않고 `getApplicableRates()`가
 *   조회한 rates 파일의 `laborStandards`에서 읽는다.
 */
export function calculateWeeklyHolidayAllowance(
  input: WeeklyHolidayAllowanceInput,
): WeeklyHolidayAllowanceResult {
  const { hourlyWage, weeklyHours } = input;
  const rates = getApplicableRates();

  const statutoryWeeklyHours = rates.laborStandards.statutoryWeeklyHours.value; // 40
  const statutoryDailyHours = rates.laborStandards.statutoryDailyHours.value; // 8
  const ultraShortTimeWeeklyHours =
    rates.laborStandards.ultraShortTimeWeeklyHours.value; // 15
  const { daysPerYear, monthsPerYear, daysPerWeek } =
    rates.laborStandards.monthlyWeekFactor.value; // 365 / 12 / 7
  const minimumHourlyWage = rates.minimumWage.hourly.value;

  // 1. 1주 주휴시간 — min((weeklyHours ÷ 40) × 8, 8). 반올림하지 않는다(예: 23÷5 = 4.6, 13.5÷5 = 2.7).
  const weeklyHolidayHours = Math.min(
    (weeklyHours / statutoryWeeklyHours) * statutoryDailyHours,
    statutoryDailyHours,
  );

  // 2. 1주치 주휴수당(핵심 결과) — 완전정밀도.
  const weeklyHolidayPay = weeklyHolidayHours * hourlyWage;

  // 3. 월 환산 주휴수당(참고액) — 곱셈 먼저, 나눗셈(÷ 84)은 마지막에 1회.
  const monthlyHolidayPay =
    (weeklyHolidayPay * daysPerYear) / (monthsPerYear * daysPerWeek);

  // 4. 주휴수당 포함 주급 — 연장근로 가산수당은 반영하지 않는다(FORMULA.md "공식의 전제조건").
  const weeklyTotalPay = weeklyHours * hourlyWage + weeklyHolidayPay;

  // 5. 주휴수당 포함 월급(참고액).
  const monthlyTotalPay =
    (weeklyTotalPay * daysPerYear) / (monthsPerYear * daysPerWeek);

  // 6. 주휴수당 포함 실질 시급 — 분모 weeklyHours는 validation에서 `> 0` 보장.
  const effectiveHourlyWage = weeklyTotalPay / weeklyHours;

  // 7. 15시간 이상 요건 충족 여부 — 게이팅 아님, 경고 표시용.
  const meetsMinHoursRequirement = weeklyHours >= ultraShortTimeWeeklyHours;

  // 8. 최저임금 미만 여부 — 게이팅 아님, 참고 경고용.
  const belowMinimumWage = hourlyWage < minimumHourlyWage;

  // 9. 주 40시간 초과로 주휴시간이 8시간 상한에 걸렸는지 — breakdown 고지용.
  const cappedAtStatutoryLimit = weeklyHours > statutoryWeeklyHours;

  return {
    weeklyHolidayHours,
    weeklyHolidayPay,
    monthlyHolidayPay,
    weeklyTotalPay,
    monthlyTotalPay,
    effectiveHourlyWage,
    meetsMinHoursRequirement,
    belowMinimumWage,
    minimumHourlyWage,
    appliedRateYear: APPLICABLE_RATE_YEAR,
    cappedAtStatutoryLimit,
  };
}
