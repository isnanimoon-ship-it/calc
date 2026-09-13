/**
 * 퇴직금 계산기 — 표시용 포맷팅.
 *
 * docs/CALCULATOR_RULES.md "금액/숫자 연산": 화면 표시는 Intl.NumberFormat('ko-KR')로 통일한다.
 *
 * (2026-09-02 Formula Analyst 재검토 반영) logic.ts의 averageDailyWage는 이제 이미 전 단위
 * (0.01원)에서 올림 확정된 값이다(moel.go.kr 방식 채택, FORMULA.md "정밀도/반올림 정책" 참고).
 * 아래 formatAverageDailyWageDetailed는 그 값을 "원/전" 문자열로 쪼개 보여주기만 할 뿐,
 * 별도의 정책적 반올림을 다시 수행하지 않는다 — 이미 정수 jeon인 값에 ceil을 적용하는 것은
 * 항등 연산(idempotent)이다(부동소수점 표현 오차 보정용 EPSILON만 방어적으로 유지).
 */

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 부동소수점 표현 오차 보정용 아주 작은 여유값(전 단위 스케일에서 안전한 크기). */
const EPSILON = 1e-6;

/** 정수 원 금액을 "1,234,567원" 형태로 표시한다. */
export function formatWon(amountWon: number): string {
  return `${wonFormatter.format(Math.round(amountWon))}원`;
}

/** 일수를 "1,080일" 형태로 표시한다. */
export function formatDays(days: number): string {
  return `${wonFormatter.format(days)}일`;
}

/** 시간을 "40시간" 형태로 표시한다(소수 허용, 예: "14.5시간"). */
export function formatHours(hours: number): string {
  return `${wonFormatter.format(hours)}시간`;
}

/**
 * 1일 평균임금(이미 전 단위 올림 확정된 값, 원 단위) 화면 표시용 문자열.
 *
 * FORMULA.md "정밀도/반올림 정책": 1일 평균임금은 소수 둘째 자리(전 단위)에서 "올림"해
 * "88,641원 31전"처럼 표시한다 — logic.ts가 이미 이 올림을 확정해 averageDailyWage 필드로
 * 반환하므로(5단계), 이 함수는 그 값을 "원/전" 두 부분으로 쪼개 표시하는 역할만 한다.
 * 근거: 고용노동부 행정해석 퇴직연금복지과-777(2009.4.1.) — 2차 출처(nodong.kr) 교차확인,
 * 원문 미열람으로 부분 확인 상태(FORMULA.md 참고).
 */
export function formatAverageDailyWageDetailed(
  averageDailyWageWon: number,
): string {
  const jeonExact = averageDailyWageWon * 100;
  const jeonRoundedUp = Math.ceil(jeonExact - EPSILON);
  const wonPart = Math.floor(jeonRoundedUp / 100);
  const jeonPart = jeonRoundedUp - wonPart * 100;
  return `${wonFormatter.format(wonPart)}원 ${jeonPart}전`;
}
