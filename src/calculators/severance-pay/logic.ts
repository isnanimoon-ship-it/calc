/**
 * 퇴직금 계산기 — 순수 계산 로직.
 *
 * tasks/severance-pay/FORMULA.md의 "공식" / "계산 순서" / "정밀도·반올림 정책" 절을
 * 그대로 구현한다. 공식이나 반올림 정책을 이 파일에서 임의로 바꾸지 않는다.
 *
 * 숫자 정밀도 전략(2026-09-02 Formula Analyst 재검토로 갱신 — moel.go.kr 실제 소스코드
 * (`retire_cal.js`/`retire_util.js`) 확인 기반. 구 정책("완전정밀도 유지, 재사용 금지")은
 * 폐기됐다):
 * - 입력 금액(원 단위 정수)은 즉시 ×100(전 단위 정수)으로 스케일링한다.
 * - 상여금/연차수당 가산액(3~4단계)은 반올림하지 않고 분수(전 단위 실수) 그대로 유지한다.
 * - **1일 평균임금(5단계)은 전 단위(0.01원)에서 올림(ceil)해 정수 jeon으로 확정하고,
 *   이 올림 확정값을 6단계(기준임금 비교)·7단계(최종 곱셈)까지 그대로 재사용한다.**
 *   moel.go.kr이 실제로 쓰는 방식이며(`avrPayCal()`가 올림한 값을 `calRet()`이 다시 파싱해
 *   그대로 사용), FORMULA.md "정밀도/반올림 정책" 절이 이 방식을 v1 정책으로 채택했다.
 *   즉 averageDailyWage/baseDailyWage 필드는 더 이상 완전정밀도 값이 아니라 이미 전 단위로
 *   올림 확정된 값이다 — 화면 표시값과 계산에 재사용되는 값이 동일하다.
 * - 최종 퇴직금(7~8단계)은 나눗셈(÷365)을 맨 마지막 한 번만 수행한 뒤 원 단위로 반올림한다.
 */

import {
  calculateCalendarPeriodDaysBefore,
  diffDaysUtc,
  parseIsoDateUtc,
} from "@/src/lib/date-calc";
import type {
  SeverancePayInput,
  SeverancePayResult,
  WeeklyHoursIneligibleReason,
} from "./types";

/** 전(錢) = 원의 1/100. 금액 스케일링 배수. */
const JEON_PER_WON = 100;

/**
 * 부동소수점 표현 오차 보정용 아주 작은 여유값(전 단위 스케일에서 안전한 크기).
 * 5단계 1일 평균임금 올림(ceil) 계산에서, 나눗셈 결과가 수학적으로는 정수 jeon이어야 하는데
 * 부동소수점 표현 오차로 아주 살짝 위(예: 8,864,131.000000001)로 나오는 경우 올림이
 * 한 단위 더 튀는 것을 막는다. formatting.ts의 동일 상수와 같은 값·같은 목적이다.
 */
const EPSILON = 1e-6;

/** 지급요건: 계속근로기간 1년(365일) 이상. 근로자퇴직급여 보장법 제4조 제1항. */
const MIN_SERVICE_DAYS_FOR_ELIGIBILITY = 365;

/** 지급요건: 4주 평균 주 소정근로시간 15시간 이상. 근로자퇴직급여 보장법 제4조 제1항. */
const MIN_WEEKLY_HOURS_FOR_ELIGIBILITY = 15;

/** 퇴직금 = 기준임금 × 30일 × (재직일수 / 365). 근로자퇴직급여 보장법 제8조. */
const SEVERANCE_DAYS_PER_YEAR = 30;
const DAYS_PER_YEAR = 365;

/** 상여금/연차수당 가산 비율(3개월 / 12개월). 분수 그대로 유지(먼저 곱하고 나중에 나눔). */
const ADDITION_NUMERATOR_MONTHS = 3;
const ADDITION_DENOMINATOR_MONTHS = 12;

/**
 * 날짜 파싱·달력일수 계산은 `src/lib/date-calc.ts`(공용 유틸)로 옮겼다(2026-09-02,
 * Architect — unemployment-benefit도 동일 baseDays 규칙을 재사용해야 해서 추출.
 * docs/ARCHITECTURE.md "날짜 계산 유틸 공용화" 결정 사례 참고). 아래는 이 파일 안에서 쓰던
 * 이름(`diffDays`)을 공용 유틸 이름(`diffDaysUtc`)에 그대로 연결하는 별칭으로,
 * 호출부 코드를 바꾸지 않기 위해 남겨 둔다.
 */
const diffDays = diffDaysUtc;

/** 원 단위 정수 금액을 전 단위 정수로 스케일링한다. */
function toJeon(won: number): number {
  return won * JEON_PER_WON;
}

/** 전 단위 값을 원 단위(완전정밀도, 반올림하지 않음)로 되돌린다. */
function jeonToWon(jeon: number): number {
  return jeon / JEON_PER_WON;
}

/**
 * 주당 소정근로시간 요건(근로자퇴직급여 보장법 제4조 제1항) 판정 결과.
 * FORMULA.md "주당 소정근로시간 기본값 정책 > 판정 로직 (우선순위)" 1~3번을 그대로 구현한다.
 */
interface WeeklyHoursEligibility {
  insufficientWeeklyHours: boolean;
  reason?: WeeklyHoursIneligibleReason;
}

/**
 * 주당 소정근로시간 요건 판정 — FORMULA.md "판정 로직 (우선순위)" 3단계 그대로:
 *   1. underFifteenHoursDeclared === true → 즉시 미충족(reason: "declared"). weeklyScheduledHours에
 *      숫자가 입력돼 있어도 이 자진신고가 우선한다.
 *   2. (1이 아니고) weeklyScheduledHours에 실제 숫자가 입력됨 → 그 값으로 >= 15 판정
 *      (미만이면 reason: "belowThreshold").
 *   3. (1, 2 모두 아님, 즉 자진신고도 없고 숫자도 미입력) → 판정을 생략하고 충족으로 간주.
 * "임의 숫자를 기본값으로 채워 넣는 방식은 채택하지 않는다"(FORMULA.md)는 원칙에 따라 이 함수는
 * 어떤 특정 시간도 추정하지 않는다 — 세 갈래 분기 자체가 그 원칙의 구현이다.
 */
function determineWeeklyHoursEligibility(
  weeklyScheduledHours: number | undefined,
  underFifteenHoursDeclared: boolean | undefined,
): WeeklyHoursEligibility {
  if (underFifteenHoursDeclared === true) {
    return { insufficientWeeklyHours: true, reason: "declared" };
  }
  if (weeklyScheduledHours != null) {
    if (weeklyScheduledHours < MIN_WEEKLY_HOURS_FOR_ELIGIBILITY) {
      return { insufficientWeeklyHours: true, reason: "belowThreshold" };
    }
    return { insufficientWeeklyHours: false };
  }
  // 우선순위 3번: 자진신고도 없고 숫자도 미입력 — 판정 생략, 충족으로 간주.
  return { insufficientWeeklyHours: false };
}

/**
 * 지급요건(근로자퇴직급여 보장법 제4조 제1항) 충족 여부만 별도로 판정한다.
 * ui.tsx 등에서 계산 전에 미리 안내 문구를 분기하고 싶을 때도 재사용할 수 있게 export한다.
 *
 * (v2, FORMULA.md "주당 소정근로시간 기본값 정책") weeklyScheduledHours가 필수 → 선택으로
 * 전환되면서 underFifteenHoursDeclared와 함께 3단계 우선순위로 판정한다
 * (determineWeeklyHoursEligibility 참고).
 */
export function isEligibleForSeverancePay(
  totalServiceDays: number,
  weeklyScheduledHours: number | undefined,
  underFifteenHoursDeclared: boolean | undefined,
): boolean {
  return (
    totalServiceDays >= MIN_SERVICE_DAYS_FOR_ELIGIBILITY &&
    !determineWeeklyHoursEligibility(weeklyScheduledHours, underFifteenHoursDeclared)
      .insufficientWeeklyHours
  );
}

/**
 * 재직일수(retireDate - hireDate)를 계산한다. FORMULA.md 2단계.
 * 입력은 validation.ts를 통과한, 형식이 올바른 ISO 날짜 문자열이라고 가정한다.
 */
export function calculateTotalServiceDays(
  hireDate: string,
  retireDate: string,
): number {
  const hire = parseIsoDateUtc(hireDate);
  const retire = parseIsoDateUtc(retireDate);
  if (!hire || !retire) {
    throw new Error(
      `calculateTotalServiceDays: 유효하지 않은 날짜 문자열 (hireDate=${hireDate}, retireDate=${retireDate})`,
    );
  }
  return diffDays(hire, retire);
}

/**
 * 산정기간 총일수(retireDate 이전 3개월의 달력일수, 89~92일)를 계산한다. FORMULA.md 3단계.
 */
export function calculateBaseDays(retireDate: string): number {
  return calculateCalendarPeriodDaysBefore(
    retireDate,
    ADDITION_NUMERATOR_MONTHS,
  );
}

/**
 * 퇴직금 계산 메인 함수. FORMULA.md "공식" 1~8단계를 그대로 구현한다.
 *
 * 입력은 validation.ts(validateSeverancePayInput)를 통과했다는 전제다 — 이 함수 자체는
 * 방어적 검증(날짜 순서, 음수 등)을 반복하지 않는다(관심사 분리: 검증은 validation.ts,
 * 계산은 logic.ts).
 */
export function calculateSeverancePay(
  input: SeverancePayInput,
): SeverancePayResult {
  const totalServiceDays = calculateTotalServiceDays(
    input.hireDate,
    input.retireDate,
  );

  // 1. 지급요건 판정 (근로자퇴직급여 보장법 제4조 제1항) — 미충족이면 계산을 아예 수행하지 않는다.
  //    (2026-09-02 Optimizer 수정 — UX/UI Critic Medium M1 대응) 판정 자체(공식)는 바꾸지 않고,
  //    두 요건 중 어느 쪽이 미충족인지를 UI가 구분해 안내할 수 있도록 사유 플래그만 함께 반환한다.
  //    (v2, FORMULA.md "주당 소정근로시간 기본값 정책") weeklyScheduledHours가 선택 입력으로
  //    바뀌면서 underFifteenHoursDeclared와 함께 3단계 우선순위로 판정한다
  //    (determineWeeklyHoursEligibility 참고) — 15시간 기준 자체(MIN_WEEKLY_HOURS_FOR_ELIGIBILITY)는
  //    바뀌지 않았다.
  const weeklyHoursEligibility = determineWeeklyHoursEligibility(
    input.weeklyScheduledHours,
    input.underFifteenHoursDeclared,
  );
  const insufficientServicePeriod =
    totalServiceDays < MIN_SERVICE_DAYS_FOR_ELIGIBILITY;
  if (insufficientServicePeriod || weeklyHoursEligibility.insufficientWeeklyHours) {
    return {
      eligible: false,
      insufficientServicePeriod,
      insufficientWeeklyHours: weeklyHoursEligibility.insufficientWeeklyHours,
      weeklyHoursIneligibleReason: weeklyHoursEligibility.reason,
    };
  }

  // 2. (위에서 이미 산출) totalServiceDays

  // 3. 산정기간 총일수 (근로기준법 제2조 제1항 제6호 — 평균임금 산정기간)
  const baseDays = calculateBaseDays(input.retireDate);

  // 전 단위 정수 스케일링 (docs/ARCHITECTURE.md 결정 사례)
  const wage3mJeon = toJeon(input.wage3m);
  const bonus12mJeon = toJeon(input.bonus12m ?? 0);
  const annualLeavePay12mJeon = toJeon(input.annualLeavePay12m ?? 0);
  const ordinaryDailyWageJeon =
    input.ordinaryDailyWage != null ? toJeon(input.ordinaryDailyWage) : null;

  // 4. 가산액 계산 — 먼저 곱한 뒤 나눔(분수 그대로 유지, 소수로 미리 변환하지 않음).
  // 근거: 고용노동부 행정해석 임금 68207-120(2003.02.24, 상여금), 임금근로시간정책팀-3295
  // (2007.11.5, 연차수당 — 2026-09-02 재검토로 "근로기준과-3295(1994.5.24)" 추정에서 정정)
  // — 두 근거 모두 FORMULA.md "기준/출처"에 "부분 확인"으로 명시되어 있다.
  const bonusAdditionJeon =
    (bonus12mJeon * ADDITION_NUMERATOR_MONTHS) / ADDITION_DENOMINATOR_MONTHS;
  const leavePayAdditionJeon =
    (annualLeavePay12mJeon * ADDITION_NUMERATOR_MONTHS) /
    ADDITION_DENOMINATOR_MONTHS;

  // 5. 1일 평균임금 (근로기준법 제2조 제1항 제6호) — 전 단위(0.01원)에서 올림(ceil)해
  //    정수 jeon으로 확정한다. **이 올림 확정값이 화면 표시값이자 6~7단계에 그대로 이어지는
  //    계산값이다**(moel.go.kr 방식 채택, FORMULA.md "정밀도/반올림 정책" 참고 — 구 정책인
  //    "완전정밀도 유지, 재사용 금지"는 폐기됐다). EPSILON은 부동소수점 표현 오차로 정수
  //    경계값이 살짝 위로 튀는 것을 막기 위한 보정이다(예제 3·6처럼 나누어떨어지는 케이스).
  const averageDailyWageJeonExact =
    (wage3mJeon + bonusAdditionJeon + leavePayAdditionJeon) / baseDays;
  const averageDailyWageJeon = Math.ceil(averageDailyWageJeonExact - EPSILON);

  // 6. 기준임금 확정 (근로기준법 제2조 제2항 — 평균임금이 통상임금보다 적으면 통상임금 적용)
  //    averageDailyWageJeon은 이미 5단계에서 전 단위로 올림 확정된 정수이고,
  //    ordinaryDailyWageJeon도 정수(입력값을 전 단위로 스케일링)이므로 정수끼리 비교한다 —
  //    moel.go.kr calRet()도 올림 확정된 avrPay 표시값을 통상임금과 비교한다.
  const baseDailyWageJeon =
    ordinaryDailyWageJeon != null
      ? Math.max(averageDailyWageJeon, ordinaryDailyWageJeon)
      : averageDailyWageJeon;

  // 7. 퇴직금(완전정밀도) — baseDailyWageJeon(이미 5~6단계에서 올림 확정된 정수)을 기준으로,
  //    나눗셈(÷365)은 분자를 모두 곱한 뒤 마지막에 한 번만 수행한다.
  //    (근로자퇴직급여 보장법 제8조 — 계속근로기간 1년에 대해 30일분 평균임금)
  const severancePayJeonExact =
    (baseDailyWageJeon * SEVERANCE_DAYS_PER_YEAR * totalServiceDays) /
    DAYS_PER_YEAR;

  // 8. 최종 반올림 — 원 단위 반올림(사사오입). moel.go.kr 소스코드(`retire_cal.js` `calRet()`,
  //    `Math.round(reCalcSal)`)로 확인됨(FORMULA.md "정밀도/반올림 정책" 8단계 참고).
  //    법령상 명문 규정은 여전히 미발견이나, 정부 공식 계산기의 실제 구현임은 확인됨.
  const severancePay = Math.round(jeonToWon(severancePayJeonExact));

  // 참고(types.ts와의 관계, 임의로 타입을 바꾸지 않고 주석으로만 남김):
  // types.ts 상단의 `Won` 타입 주석은 "원(₩) 단위 정수"라고 되어 있지만, 아래
  // bonusAddition/leavePayAddition 두 필드는 FORMULA.md 4단계가 요구하는 대로 반올림하지 않은
  // 분수 값이라 실제로는 정수가 아닐 수 있다. averageDailyWage/baseDailyWage는 5단계에서
  // 이미 전 단위(0.01원)로 올림 확정됐으므로 "원 단위 정수"는 아니지만 소수 둘째 자리까지의
  // 확정값(예: 88641.31)이다. 원 단위 정수로 완전히 확정되는 것은 입력값들과 최종
  // severancePay뿐이다. 타입 정의 자체(Won = number)는 그대로 두되, 이 차이를 여기 기록해 둔다.
  return {
    eligible: true,
    totalServiceDays,
    baseDays,
    bonusAddition: jeonToWon(bonusAdditionJeon),
    leavePayAddition: jeonToWon(leavePayAdditionJeon),
    averageDailyWage: jeonToWon(averageDailyWageJeon),
    baseDailyWage: jeonToWon(baseDailyWageJeon),
    severancePay,
  };
}
