/**
 * 주휴수당 계산기 — 타입 정의 (Architect 산출물, 실제 타입은 여기서 확정한다).
 *
 * 계산 구현은 logic.ts, 검증은 validation.ts, 표시 포맷팅은 formatting.ts, UI는 ui.tsx —
 * 나머지 파일은 Builder 단계에서 채운다 (docs/ARCHITECTURE.md "계산 로직 / UI 분리",
 * tasks/weekly-holiday-allowance/ARCHITECTURE.md 참고).
 *
 * 필드 정의는 tasks/weekly-holiday-allowance/FORMULA.md의 "입력값" / "출력값" 표를 그대로
 * 옮긴 것이다.
 *
 * severance-pay / unemployment-benefit과 다른 구조적 특징:
 * - **판별 유니온(eligible: true | false)이 없다.** 이 계산기는 SPEC.md "설계상 핵심 결정"에
 *   따라 지급요건(15시간 이상·개근)으로 계산을 막지 않는다 — 요건 충족 여부와 무관하게 항상
 *   모든 금액을 계산·반환하고, 요건 미충족은 결과에 포함된 boolean 플래그(경고 표시용)로만
 *   전달한다. 따라서 결과 타입은 단일 interface다.
 * - **날짜 입력이 없다.** "몇 년도 최저임금을 쓸지"를 입력에서 끌어낼 수 없어, 적용 연도를
 *   logic.ts의 `APPLICABLE_RATE_YEAR` 상수로 고정하고 그 연도와 최저임금 값을 결과에 실어
 *   보낸다(tasks/weekly-holiday-allowance/ARCHITECTURE.md "적용 연도 선택 로직" 참고).
 *
 * 이 타입들은 "원(₩) / 시간(hour)"이라는 사용자가 이해하는 경계(boundary) 단위를 쓴다 —
 * logic.ts 내부 정밀도 전략(이 계산기는 전 단위 스케일링·BigInt·decimal 없이 JS `Number`,
 * ARCHITECTURE.md "숫자 정밀도 전략" 참고)과 무관하게 입출력 단위는 유지한다.
 */

/** 원(₩) 단위 금액. 표시 직전 원 단위 반올림(formatting.ts의 `roundWon`)을 적용하기 전에는 소수를 포함할 수 있다. */
export type Won = number;

/**
 * 검증을 통과해 logic.ts(`calculateWeeklyHolidayAllowance`)가 받는 입력.
 * FORMULA.md "입력값" 표 그대로다. 폼에서 넘어온 원시 문자열 입력(콤마 포함 가능)은
 * validation.ts의 `RawWeeklyHolidayAllowanceFormInput`이며, 여기서는 이미 숫자로 정규화됐다.
 */
export interface WeeklyHolidayAllowanceInput {
  /**
   * 시급(원). 세금·4대보험 공제 전 시간당 임금. `> 0`.
   * Architect 결정(ARCHITECTURE.md "입력 필드 설계"): **정수만 허용**한다 — 국내 시급·최저임금·
   * 채용공고가 모두 원 단위 정수이고, 대상 사용자(아르바이트·시간제)가 자기 시급을 소수로
   * 인지하는 경우가 없다. 공식 자체는 실수도 처리하지만 입력 UX에서 소수를 받지 않는다.
   * 상식적 상한은 validation.ts의 `MAX_HOURLY_WAGE`.
   */
  hourlyWage: number;
  /**
   * 1주 소정근로시간(시간). **휴게시간 제외.** `> 0`, `<= 168`.
   * Architect 결정: **0.5시간 단위 소수 입력 허용**(휴게시간을 뺀 실근로시간이 13.5시간처럼
   * 소수로 떨어지는 경우가 흔함, FORMULA.md 예제 7). step은 UI 힌트일 뿐이고 검증에서
   * 0.5 배수를 강제하지는 않는다(13.3 등도 허용). 40 초과는 오류가 아니라 logic.ts에서
   * 주휴시간을 8시간으로 상한 처리한다(FORMULA.md "예외").
   * 개념적으로는 "4주 평균 1주 소정근로시간"이지만 이 계산기는 단일 값 1개만 받아 그 값을
   * 4주 평균값으로 간주한다(FORMULA.md "입력값" 주석).
   */
  weeklyHours: number;
}

/**
 * logic.ts(`calculateWeeklyHolidayAllowance`)의 반환 타입. FORMULA.md "출력값" 표 8개 필드에,
 * 화면 표시(정책형 계산기 고지·최저임금 경고 문구)에 필요한 파생 필드 3개를 더한 것이다.
 *
 * **반올림 규약(FORMULA.md "정밀도/반올림 정책")**: 아래 금액 필드(`weeklyHolidayPay`,
 * `monthlyHolidayPay`, `weeklyTotalPay`, `monthlyTotalPay`, `effectiveHourlyWage`)는 logic.ts가
 * **반올림하지 않은 완전정밀도 값**으로 반환한다. 원 단위 반올림은 표시 직전에 formatting.ts의
 * `roundWon()`이 각 값에 독립적으로 1회만 적용한다 — 반올림된 값을 다른 값의 계산에
 * 재사용하지 않는다는 정책을 "logic은 exact만 반환, 반올림은 표시 경로에만 존재"라는 구조로
 * 강제한다(ARCHITECTURE.md "숫자 정밀도 전략" 참고).
 */
export interface WeeklyHolidayAllowanceResult {
  /**
   * 1주 주휴시간(시간). `min(weeklyHours / 40 * 8, 8)` = `min(weeklyHours / 5, 8)`.
   * 금액이 아니므로 반올림하지 않고 소수 그대로 반환한다(예: 4.6, 2.7). 표시는 소수 최대 2자리.
   */
  weeklyHolidayHours: number;
  /**
   * 1주치 주휴수당(원) = `weeklyHolidayHours × hourlyWage`. **핵심 결과 카드 권고값(SPEC).**
   * 완전정밀도(대부분 정수로 떨어지지만 소수 시간·소수 결과가 나올 수 있음).
   */
  weeklyHolidayPay: Won;
  /**
   * 월 환산 주휴수당(원, 참고액) = `weeklyHolidayPay(반올림 전) × 365 ÷ 84`.
   * `÷ 84`(= ÷ 12 ÷ 7)는 곱셈 뒤 마지막에 1회만 수행한다.
   */
  monthlyHolidayPay: Won;
  /**
   * 주휴수당 포함 주급(원) = `weeklyHours × hourlyWage + weeklyHolidayPay(반올림 전)`.
   * 연장근로 가산수당은 반영하지 않는다(FORMULA.md "공식의 전제조건").
   */
  weeklyTotalPay: Won;
  /** 주휴수당 포함 월급(원, 참고액) = `weeklyTotalPay(반올림 전) × 365 ÷ 84`. */
  monthlyTotalPay: Won;
  /**
   * 주휴수당 포함 실질 시급(원/시간) = `weeklyTotalPay(반올림 전) ÷ weeklyHours`.
   * SPEC Should Have. 핵심 카드가 아니라 breakdown 항목.
   * 분모 `weeklyHours`는 validation에서 `> 0`이 보장되므로 0 나눗셈은 발생하지 않는다.
   */
  effectiveHourlyWage: Won;
  /**
   * 15시간 이상 요건 충족 여부 = `weeklyHours >= 15`. **게이팅 아님** — `false`여도 위 금액은
   * 모두 그대로 계산·반환된다. UI가 "15시간 미만이면 실제로는 주휴수당이 발생하지 않는다"는
   * 경고를 눈에 띄게 표시하는 데만 쓴다(FORMULA.md "계산 순서" 10, "예외").
   */
  meetsMinHoursRequirement: boolean;
  /**
   * 입력 시급이 해당 연도 최저임금 시급 미만인지 = `hourlyWage < minimumHourlyWage`.
   * **게이팅 아님** — 참고 경고용 boolean(SPEC Should Have).
   */
  belowMinimumWage: boolean;
  /**
   * `belowMinimumWage` 판정에 쓴 해당 연도 최저임금(원/시간). `rates-{year}.json`의
   * `minimumWage.hourly.value`를 그대로 실어 보낸다 — UI가 경고 문구
   * ("입력한 시급이 {appliedRateYear}년 최저임금 시간당 {값}원보다 낮습니다")에 쓴다.
   * 값은 반드시 데이터 파일에서 오며 계산기 코드에 하드코딩하지 않는다(SPEC Should Have).
   */
  minimumHourlyWage: number;
  /**
   * 적용 기준 연도. 이 계산기는 날짜 입력이 없어 입력에서 연도를 끌어낼 수 없으므로
   * logic.ts의 `APPLICABLE_RATE_YEAR` 상수를 그대로 실어 보낸다. 정책형 계산기 고지
   * ("이 계산은 {연도}년 기준이며 최저임금 등은 매년 갱신될 수 있습니다")와 최저임금 경고
   * 문구에 쓴다(SPEC "정책 고지 문구", FORMULA.md "기준/출처").
   */
  appliedRateYear: number;
  /**
   * (Architect 추가 — FORMULA.md "출력값" 표에는 없지만 UI 고지에 필요한 파생 플래그)
   * 입력한 `weeklyHours`가 40을 초과해 `weeklyHolidayHours`가 8시간 상한에 걸렸는지 여부
   * (`weeklyHours > 40`). breakdown에 "주 40시간을 초과한 시간은 주휴수당 산정에 포함되지
   * 않습니다 / 연장근로 가산수당은 계산하지 않습니다"를 조건부로 표시하기 위한 것이다
   * (FORMULA.md "예외" `weeklyHours`가 40 초과 항목, SPEC FAQ 5). 공식 자체를 바꾸는
   * 필드가 아니라 이미 계산된 상태를 UI가 재판정 없이 읽도록 노출할 뿐이다
   * (severance-pay가 `weeklyHoursIneligibleReason`을 노출한 것과 같은 성격).
   */
  cappedAtStatutoryLimit: boolean;
}
