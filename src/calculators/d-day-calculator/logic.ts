/**
 * 디데이 계산기 — 모드 A(날짜 차이)·모드 B(날짜 이동) 순수 계산 로직.
 *
 * tasks/d-day-calculator/FORMULA.md "공식"·"계산 순서"를 그대로 구현한다. 이 계산기 전용
 * 날짜 직렬번호/요일 함수를 새로 만들지 않고 `src/lib/date-calc.ts`의 기존 검증된 함수
 * (`parseIsoDateUtc`/`diffDaysUtc`/`addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`)만 사용한다
 * (tasks/d-day-calculator/ARCHITECTURE.md "1.3" — 다섯 번째 중복 구현 방지).
 *
 * average-cost-calculator 등 다른 계산기의 관례("logic.ts는 이미 validation.ts를 통과한
 * 유효한 입력만 받는다는 전제로 동작")와 달리, 이 파일은 FORMULA.md "계산 순서"의 형식·범위
 * 검증 단계까지 방어적으로 함께 구현한다 — ARCHITECTURE.md "6."이 FORMULA.md Golden Test
 * 26개(오류 케이스 #14·#15·#23·#24 포함)를 전부 `calculateDday`/`calculateDateShift`를 직접
 * 호출해 검증하도록 지시했기 때문이다. UI 계층의 사용자 친화적 필드별 오류 메시지는
 * validation.ts가 사전에 별도로 담당하며, 이 파일의 검증은 "잘못된 입력이 조용히 잘못된
 * 결과를 내지 않는다"는 불변식을 지키는 마지막 방어선이다(`business-days/logic.ts`가 영업일
 * 탐색 도중 지원 범위를 벗어나면 `RangeError`를 던지는 것과 동일한 관례).
 */

import {
  addDaysUtc,
  diffDaysUtc,
  formatIsoDateUtc,
  parseIsoDateUtc,
  weekdayUtc,
} from "@/src/lib/date-calc";
import type {
  DateShiftCalculationInput,
  DateShiftCalculationResult,
  DdayCalculationInput,
  DdayCalculationResult,
  Weekday,
  WeeksBreakdown,
} from "./types";
import { MAX_SHIFT_DAYS, MAX_SUPPORTED_DATE, MIN_SUPPORTED_DATE } from "./validation";

/**
 * FORMULA.md "주 단위 환산(Should Have)" 공식. `n === 0`(당일)이면 표시할 의미가 없으므로
 * `null`을 반환한다. 나눗셈은 항상 `floor`만 쓴다(FORMULA.md "정밀도/반올림 정책").
 *
 * 모드 A(`n = |diffDays|`)뿐 아니라 모드 B(`n = days`)에도 적용 가능한 일반형으로 둔다
 * (ARCHITECTURE.md "4." — 나중에 모드 B에도 노출하고 싶어지면 이 함수를 건드리지 않고 호출부만
 * 추가하면 된다).
 */
export function computeWeeksBreakdown(n: number): WeeksBreakdown | null {
  if (n === 0) return null;
  const weeks = Math.floor(n / 7);
  const remainderDays = n - weeks * 7;
  return { weeks, remainderDays };
}

/**
 * 날짜 문자열이 형식·실존 여부·지원 범위(1900-01-01~2200-12-31)를 모두 만족하는지 확인하고
 * `Date`로 반환한다. 하나라도 위반하면 던진다(FORMULA.md "예외" — 존재하지 않는 날짜/지원
 * 범위 밖 입력은 계산하지 않는다).
 */
function parseAndCheckSupportedDate(iso: string, label: string): Date {
  const parsed = parseIsoDateUtc(iso);
  if (!parsed) {
    throw new Error(`유효하지 않은 ${label}입니다 (${iso}).`);
  }
  if (iso < MIN_SUPPORTED_DATE || iso > MAX_SUPPORTED_DATE) {
    throw new RangeError(
      `${label}은(는) ${MIN_SUPPORTED_DATE}부터 ${MAX_SUPPORTED_DATE}까지만 계산할 수 있습니다.`,
    );
  }
  return parsed;
}

/**
 * 모드 A: 날짜 차이(diff, fencepost 규칙) — FORMULA.md "계산 순서 — 모드 A" 1~5단계.
 *
 * `diff = daySerial(targetDate) - daySerial(startDate)`이며, 시작일=목표일이면 `D-Day`,
 * 목표일이 미래면 `D-N`(N=목표일−시작일), 과거면 `D+N`(N=시작일−목표일)이다(SPEC.md "날짜 차이
 * 계산 정의"). 인클루시브 카운트(+1)는 어떤 경로로도 계산하지 않는다.
 */
export function calculateDday(input: DdayCalculationInput): DdayCalculationResult {
  const start = parseAndCheckSupportedDate(input.startDate, "시작일");
  const target = parseAndCheckSupportedDate(input.targetDate, "목표일");

  const diffDays = diffDaysUtc(start, target);
  const ddayLabel =
    diffDays === 0 ? "D-Day" : diffDays > 0 ? `D-${diffDays}` : `D+${-diffDays}`;

  return {
    startDate: input.startDate,
    targetDate: input.targetDate,
    diffDays,
    ddayLabel,
    weeksBreakdown: computeWeeksBreakdown(Math.abs(diffDays)),
    startWeekday: weekdayUtc(start) as Weekday,
    targetWeekday: weekdayUtc(target) as Weekday,
  };
}

/**
 * 모드 B: 날짜 이동(add) — FORMULA.md "계산 순서 — 모드 B" 1~6단계.
 *
 * 5단계("resultDate도 지원 범위 안인지 다시 검증")를 생략하면 FORMULA.md가 명시적으로
 * "계산기 결함으로 반려 대상"이라고 규정한 항목이다 — `days` 상한(100,000) 통과와 무관하게
 * `baseDate`의 위치에 따라 산술 결과가 지원 범위를 벗어날 수 있다(예: 2000-01-01 + 100,000일
 * = 2273-10-16, Golden Test #23). 반드시 결과를 다시 검증한다.
 */
export function calculateDateShift(
  input: DateShiftCalculationInput,
): DateShiftCalculationResult {
  const base = parseAndCheckSupportedDate(input.baseDate, "기준일");

  if (!Number.isInteger(input.days) || input.days < 0) {
    throw new Error(`일수는 0 이상의 정수여야 합니다 (days=${input.days}).`);
  }
  if (input.days > MAX_SHIFT_DAYS) {
    throw new RangeError(
      `일수는 ${MAX_SHIFT_DAYS.toLocaleString("ko-KR")}일까지 입력할 수 있습니다.`,
    );
  }

  const signedDays = input.direction === "add" ? input.days : -input.days;
  const resultDateObj = addDaysUtc(base, signedDays);
  const resultDate = formatIsoDateUtc(resultDateObj);

  if (resultDate < MIN_SUPPORTED_DATE || resultDate > MAX_SUPPORTED_DATE) {
    throw new RangeError(
      `계산된 날짜(${resultDate})가 지원 범위(${MIN_SUPPORTED_DATE}~${MAX_SUPPORTED_DATE})를 ` +
        "벗어났습니다. 기준일 또는 일수를 다시 확인해 주세요.",
    );
  }

  return {
    baseDate: input.baseDate,
    days: input.days,
    direction: input.direction,
    resultDate,
    resultWeekday: weekdayUtc(resultDateObj) as Weekday,
  };
}
