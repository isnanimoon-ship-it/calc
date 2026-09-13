/**
 * 디데이 계산기 — 모드 A/B 입력 검증.
 *
 * tasks/d-day-calculator/ARCHITECTURE.md "10." 3번 — 지원 날짜 범위 상수
 * (`MIN_SUPPORTED_DATE`~`MAX_SUPPORTED_DATE`)와 모드 B 일수 상한(`MAX_SHIFT_DAYS`)을 이
 * 파일에 도메인 상수로 둔다(`src/lib/date-calc.ts`는 순수 날짜 산술만 담당하고 이 계산기
 * 고유의 상한을 두지 않는다 — average-cost-calculator의 decimal-scale.ts/validation.ts
 * 경계와 동일 원칙).
 *
 * 이 사이트는 zod를 정식 의존성으로 쓰지 않으므로(package.json에 없음) 순수 TypeScript 검증
 * 함수로 구현한다(average-cost-calculator/validation.ts와 동일한 선택).
 * `ValidationResult` 판별 유니온은 age-calculator/validation.ts 선례대로 이 파일에 로컬로
 * 정의한다(types.ts에 두지 않음).
 */

import { parseIsoDateUtc } from "@/src/lib/date-calc";
import type {
  DateShiftCalculationInput,
  DateShiftDirection,
  DdayCalculationInput,
  DdayCalculatorShareState,
} from "./types";

/** FORMULA.md "기준" — 시작일/목표일/기준일 공통 지원 범위. */
export const MIN_SUPPORTED_DATE = "1900-01-01";
export const MAX_SUPPORTED_DATE = "2200-12-31";

/**
 * FORMULA.md "N 상한(모드 B 일수) 근거" — 입력 필드 자체의 합리적 상한이다. 계산 결과
 * (`resultDate`)가 항상 지원 범위 안에 있다는 보장은 이 상한만으로 성립하지 않으므로,
 * 결과 재검증은 반드시 logic.ts가 별도로 수행한다(FORMULA.md "계산 순서" 모드 B 5단계).
 */
export const MAX_SHIFT_DAYS = 100_000;

/** "YYYY-MM-DD" 형식이며 실제로 존재하는 날짜인지 확인한다(왕복 검증, date-calc.ts 재사용). */
export function isValidIsoDate(value: string): boolean {
  return parseIsoDateUtc(value) !== null;
}

// ── 모드 A: 디데이 계산 ──────────────────────────────────────────────────

export interface RawDdayInput {
  startDate: string;
  targetDate: string;
}

export interface DdayFieldError {
  field: keyof RawDdayInput;
  message: string;
}

export type DdayValidationResult =
  | { success: true; data: DdayCalculationInput }
  | { success: false; errors: DdayFieldError[] };

/**
 * 날짜 필드 공통 검증(필수 → 형식·실존 → 지원 범위). "시작일"/"목표일"/"기준일" 세 라벨 모두
 * "일"로 끝나 조사(을/은)가 동일하므로 공용 헬퍼로 둔다.
 */
function validateSupportedDateField<Field extends string>(
  field: Field,
  value: string,
  label: string,
): { field: Field; message: string } | null {
  if (!value) return { field, message: `${label}을 입력해 주세요.` };
  if (!isValidIsoDate(value)) return { field, message: `올바른 ${label}을 입력해 주세요.` };
  if (value < MIN_SUPPORTED_DATE || value > MAX_SUPPORTED_DATE) {
    return {
      field,
      message: `${label}은 ${MIN_SUPPORTED_DATE}부터 ${MAX_SUPPORTED_DATE}까지만 입력할 수 있습니다.`,
    };
  }
  return null;
}

/**
 * 모드 A 입력 검증. SPEC.md "시작일과 목표일의 선후관계에는 제약이 없다"에 따라 두 날짜의
 * 순서는 검증하지 않는다(business-days의 "종료일은 시작일보다 빠를 수 없다"와 의도적으로 다름).
 */
export function validateDdayInput(raw: RawDdayInput): DdayValidationResult {
  const errors: DdayFieldError[] = [];

  const startError = validateSupportedDateField("startDate", raw.startDate, "시작일");
  if (startError) errors.push(startError);

  const targetError = validateSupportedDateField("targetDate", raw.targetDate, "목표일");
  if (targetError) errors.push(targetError);

  if (errors.length > 0) return { success: false, errors };
  return { success: true, data: { startDate: raw.startDate, targetDate: raw.targetDate } };
}

// ── 모드 B: 날짜 계산(더하기/빼기) ───────────────────────────────────────

export interface RawDateShiftInput {
  baseDate: string;
  /** ui.tsx 폼 상태 — 검증 전이라 문자열이다(콤마 없는 순수 숫자 문자열). */
  days: string;
  direction: DateShiftDirection;
}

export interface DateShiftFieldError {
  field: "baseDate" | "days";
  message: string;
}

export type DateShiftValidationResult =
  | { success: true; data: DateShiftCalculationInput }
  | { success: false; errors: DateShiftFieldError[] };

/**
 * 모드 B 입력 검증. SPEC.md "방향은 별도의 더하기/빼기 토글로 선택하므로 `days` 필드 자체는
 * 항상 0 이상의 정수만 허용"에 따라 부호·소수점·비숫자 문자를 모두 형식 오류로 거부한다.
 */
export function validateDateShiftInput(raw: RawDateShiftInput): DateShiftValidationResult {
  const errors: DateShiftFieldError[] = [];

  const baseError = validateSupportedDateField("baseDate", raw.baseDate, "기준일");
  if (baseError) errors.push(baseError);

  const trimmedDays = raw.days.trim();
  let days = 0;
  if (!trimmedDays) {
    errors.push({ field: "days", message: "일수를 입력해 주세요." });
  } else if (!/^\d+$/.test(trimmedDays)) {
    errors.push({ field: "days", message: "일수는 0 이상의 정수로 입력해 주세요." });
  } else {
    days = Number(trimmedDays);
    if (days > MAX_SHIFT_DAYS) {
      errors.push({
        field: "days",
        message: `일수는 ${MAX_SHIFT_DAYS.toLocaleString("ko-KR")}일까지 입력할 수 있습니다.`,
      });
    }
  }

  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: { baseDate: raw.baseDate, days, direction: raw.direction },
  };
}

// ── 공유 상태(DdayCalculatorShareState) 파싱 ─────────────────────────────

/**
 * `decodeShareState`가 반환한 `unknown` 페이로드를 `DdayCalculatorShareState`로 파싱한다.
 * 손상되거나 조작된 공유 링크를 방어하기 위해 각 필드를 다시 검증한다
 * (average-cost-calculator/validation.ts의 `parseAverageCostShareState`와 동일 층위).
 */
export function parseDdayCalculatorShareState(
  data: unknown,
): DdayCalculatorShareState | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;

  if (record.mode === "dday") {
    if (typeof record.startDate !== "string" || typeof record.targetDate !== "string") {
      return null;
    }
    const validation = validateDdayInput({
      startDate: record.startDate,
      targetDate: record.targetDate,
    });
    if (!validation.success) return null;
    return { mode: "dday", ...validation.data };
  }

  if (record.mode === "dateShift") {
    if (
      typeof record.baseDate !== "string" ||
      typeof record.days !== "number" ||
      (record.direction !== "add" && record.direction !== "subtract")
    ) {
      return null;
    }
    const validation = validateDateShiftInput({
      baseDate: record.baseDate,
      days: String(record.days),
      direction: record.direction,
    });
    if (!validation.success) return null;
    return { mode: "dateShift", ...validation.data };
  }

  return null;
}
