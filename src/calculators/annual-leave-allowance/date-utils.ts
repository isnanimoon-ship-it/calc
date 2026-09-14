/**
 * 연차수당 계산기 — 날짜 유틸(월/연 anniversary + 명시적 clamp).
 *
 * tasks/annual-leave-allowance/FORMULA.md "날짜 유틸" 절, tasks/annual-leave-allowance/
 * ARCHITECTURE.md "1."을 그대로 구현한다.
 *
 * **`src/lib/date-calc.ts`의 기존 `calendarFullMonthsBetweenUtc`/`calendarFullYearsBetweenUtc`는
 * 절대 재사용하지 않는다** — 그 두 함수는 (월,일) 튜플만 직접 비교해 월말/윤년 clamp를 전혀
 * 하지 않고, 이 계산기가 가장 신경 쓰는 경계(월말 29~31일 입사, 2/29 윤년 입사)에서 조용히
 * 틀린 값을 낸다(ARCHITECTURE.md "1.3" 반례: hireDate=2025-01-31/referenceDate=2025-02-28 →
 * 올바른 completedMonths=1인데 기존 함수는 0을 반환; hireDate=2024-02-29/referenceDate=
 * 2025-02-28 → 올바른 completedYears=1인데 기존 함수는 0을 반환). `parseIsoDateUtc`/
 * `lastDayOfMonthUtc`만 재사용한다(도메인 의미가 없는 순수 달력 산술).
 *
 * "원본 날짜(hire) 기준으로 k를 항상 독립적으로 계산한다"는 원칙을 지킨다 — 이전 회차의
 * clamp 결과에 다시 1개월/1년을 더하는 "연쇄 계산"을 하지 않는다(FORMULA.md 예시:
 * H=2024-01-31이면 monthAnniversary(H,2)=2024-03-31이지 "2024-02-29(clamp 결과)+1개월=
 * 2024-03-29"가 아니다 — 아래 각 함수가 매번 hire 원본에서 새로 (연,월)을 계산하는 이유).
 */

import { lastDayOfMonthUtc } from "@/src/lib/date-calc";

/** 근속연수가 이론상 무한히 늘어나는 것을 막기 위한 안전 상한(년). 계산 결과에는 영향이
 *  없는 무한루프 방지용 방어 장치일 뿐이다 — 150년 이상 근속은 현실적으로 불가능하다. */
const COMPLETED_YEARS_SAFE_UPPER_BOUND = 150;

/**
 * `hire`로부터 `k`개월 후 "월 기념일"을 반환한다(k=0이면 hire 그대로).
 * `hire`의 일(day)이 대상 월에 존재하지 않으면 그 달의 마지막 날로 명시적으로 clamp한다.
 * 항상 원본 `hire`를 기준으로 (연, 월+k)를 새로 계산한다 — 이전 결과에 1개월을 더하는
 * 연쇄 계산이 아니다.
 */
export function monthAnniversary(hire: Date, k: number): Date {
  const totalMonthIndex0 = hire.getUTCMonth() + k;
  const year = hire.getUTCFullYear() + Math.floor(totalMonthIndex0 / 12);
  const monthIndex0 = totalMonthIndex0 % 12;
  const day = Math.min(hire.getUTCDate(), lastDayOfMonthUtc(year, monthIndex0));
  return new Date(Date.UTC(year, monthIndex0, day));
}

/**
 * `hire`로부터 `k`년 후 "연 기념일"을 반환한다(k=0이면 hire 그대로).
 * `hire`가 2/29(윤년)이고 대상 연도가 평년이면 2/28로 clamp한다 — 월 자체는 바뀌지 않으므로
 * `lastDayOfMonthUtc(year, hire의 월)`로 일반화하면 2월만의 특수 분기 없이 정확히 같은
 * 효과를 낸다. 항상 원본 `hire`를 기준으로 (연+k, 월)을 새로 계산한다(연쇄 계산 금지).
 */
export function yearAnniversary(hire: Date, k: number): Date {
  const year = hire.getUTCFullYear() + k;
  const monthIndex0 = hire.getUTCMonth();
  const day = Math.min(hire.getUTCDate(), lastDayOfMonthUtc(year, monthIndex0));
  return new Date(Date.UTC(year, monthIndex0, day));
}

/**
 * `k ∈ [0, 11]` 중 `monthAnniversary(hire, k) <= reference`를 만족하는 최댓값.
 * FORMULA.md `completedMonths(H, R)`.
 */
export function completedMonths(hire: Date, reference: Date): number {
  const referenceTime = reference.getTime();
  let result = 0;
  for (let k = 0; k <= 11; k += 1) {
    if (monthAnniversary(hire, k).getTime() <= referenceTime) {
      result = k;
    } else {
      break;
    }
  }
  return result;
}

/**
 * `k ∈ [0, ∞)` 중 `yearAnniversary(hire, k) <= reference`를 만족하는 최댓값.
 * FORMULA.md `completedYears(H, R)`. 무한 루프 방지를 위해 `COMPLETED_YEARS_SAFE_UPPER_BOUND`
 * 를 안전 상한으로 둔다(계산 결과에는 영향 없음 — validation.ts의 날짜 허용 범위 안에서는
 * 이 상한에 도달하지 않는다).
 */
export function completedYears(hire: Date, reference: Date): number {
  const referenceTime = reference.getTime();
  let result = 0;
  for (let k = 0; k <= COMPLETED_YEARS_SAFE_UPPER_BOUND; k += 1) {
    if (yearAnniversary(hire, k).getTime() <= referenceTime) {
      result = k;
    } else {
      break;
    }
  }
  return result;
}
