/**
 * 근로기준법 제55조제1항(유급주휴) 관련 순수 산술 — 여러 계산기가 공유하는 계산 조각.
 *
 * `weekly-holiday-allowance`와 `minimum-wage-calculator` 둘 다 "1주 소정근로시간 →
 * 1주 유급주휴시간" 산식(`min(weeklyHours / 40 * 8, 8)`)을 쓴다. 두 계산기가 각자
 * 근거로 삼는 법령은 다르지만(근로기준법 제55조제1항·시행령 제30조제1항·시행령 별표2
 * 제4호 자체는 동일 — minimum-wage-calculator는 여기에 최저임금법 시행령 제5조제2호가
 * "그 시간 수를 그대로 합산하라"고 얹어 쓸 뿐, 주휴시간 값 자체의 산정 근거는 완전히
 * 같다), 정확히 같은 산식·같은 상수(40시간·8시간)를 쓰는 "동일한 법적 정의를 공유하는
 * 순수 계산"이다(docs/ARCHITECTURE.md "판단 기준 일반화: 두 계산기가 동일한 법적 정의를
 * 공유하는 순수 계산이면 도메인이 날짜든 금액이든 src/lib/로 추출한다" 참고).
 *
 * 두 계산기가 각자 로컬로 이 산식을 복붙하면, 근로기준법 제55조·시행령 별표2가 향후
 * 개정되어 주휴시간 산정 기준이 바뀔 때 한쪽만 고치고 다른 쪽을 놓치는 드리프트 위험이
 * 생긴다(`src/lib/date-calc.ts` 추출 결정과 같은 근거).
 *
 * **이 함수는 rates-{year}.json을 직접 읽지 않는다** — 40시간·8시간은 매개변수로
 * 받는다. 두 계산기가 서로 다른 시점에 서로 다른 연도의 데이터를 적용하더라도(예: 한쪽만
 * 먼저 rates-2027.json으로 갱신되는 과도기) 이 파일 자체를 건드릴 필요가 없게 하기
 * 위함이다 — 데이터 조회 책임은 각 계산기의 `logic.ts`에 그대로 남긴다
 * (`src/lib/social-insurance.ts`가 `rates2026`을 직접 import하는 것과 다른 선택이다 —
 * 그 파일은 소비하는 두 계산기 모두 이미 같은 연도 하나만 지원해 직접 import가 자연스러웠지만,
 * 여기서는 "순수 산술, 도메인 의미 없음"이라는 `date-calc.ts` 쪽 원칙을 더 가깝게 따른다).
 */

/**
 * 1주 유급주휴시간 = `min((weeklyHours / statutoryWeeklyHours) * statutoryDailyHours, statutoryDailyHours)`.
 *
 * 반올림하지 않는다(docs/CALCULATOR_RULES.md "반올림 정책" — 중간 계산 임의 반올림 금지).
 * 호출부가 필요하면 표시 직전에만 반올림한다.
 *
 * @param weeklyHours 1주 소정근로시간(시간). 휴게시간 제외.
 * @param statutoryWeeklyHours 법정 기준근로시간(보통 40). `rates-{year}.json`의
 *   `laborStandards.statutoryWeeklyHours.value`에서 읽어 전달한다(하드코딩 금지).
 * @param statutoryDailyHours 법정 1일 기준근로시간(보통 8, 유급주휴시간 상한).
 *   `laborStandards.statutoryDailyHours.value`에서 읽어 전달한다.
 */
export function calculateWeeklyHolidayHours(
  weeklyHours: number,
  statutoryWeeklyHours: number,
  statutoryDailyHours: number,
): number {
  return Math.min(
    (weeklyHours / statutoryWeeklyHours) * statutoryDailyHours,
    statutoryDailyHours,
  );
}
