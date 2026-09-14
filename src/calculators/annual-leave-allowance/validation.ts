/**
 * 연차수당 계산기 — 입력 검증.
 *
 * tasks/annual-leave-allowance/FORMULA.md "입력값" 표 / "예외" 절, tasks/annual-leave-allowance/
 * ARCHITECTURE.md "6.3"/"11."을 그대로 구현한다. zod는 이 프로젝트의 정식 의존성이 아니므로
 * (severance-pay 선례) 순수 TypeScript 검증 함수로 작성한다.
 *
 * `MIN_ALLOWED_DATE`/`getMaxAllowedDate()`는 severance-pay와 같은 근거·같은 상수값을 이
 * 계산기 전용으로 **독립 재정의**한다(cross-import 금지 — unemployment-benefit이 세운 관례,
 * ARCHITECTURE.md "6.3": "같은 상수·같은 근거를 각 계산기 validation.ts에 '패턴 재사용'으로
 * 독립 재정의, 파일 간 cross-import는 하지 않는다").
 */

import type { AnnualLeaveAllowanceInput } from "./types";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" 형식이면서 실제로 존재하는 달력 날짜인지 확인한다(예: 2024-02-30은 거부). */
function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * 입사일 하한 / 연차 산정 기준일 상한.
 *
 * severance-pay의 `MIN_ALLOWED_DATE`/`getMaxAllowedDate()`와 같은 근거를 그대로 재사용한다
 * (ARCHITECTURE.md "6.3" — 새 상수를 만들지 않고 같은 값을 이 계산기 전용으로 독립
 * 재정의한다): 근로기준법 체계가 실질적으로 자리 잡은 1970년 이후를 입사일 하한으로 삼고,
 * 연차 산정 기준일은 "과거/미래 특정 시점으로 바꿔볼 수 있게"(SPEC.md Must Have) 오늘로부터
 * 1년 후까지는 허용한다(그보다 먼 미래는 비현실적인 오입력으로 본다).
 */
export const MIN_ALLOWED_DATE = "1970-01-01";

/** 오늘 기준 1년 후 날짜를 "YYYY-MM-DD"로 반환한다(위 `MIN_ALLOWED_DATE` 설명 참고). */
export function getMaxAllowedDate(): string {
  const now = new Date();
  const max = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));
  return max.toISOString().slice(0, 10);
}

/** 파싱된 연도가 명백히 비정상적인 자릿수를 벗어나지 않는지 확인한다(연도 자릿수 버그 방지). */
function hasPlausibleYearDigits(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

/** `value`가 [MIN_ALLOWED_DATE, getMaxAllowedDate()] 범위 안인지 확인한다(ISO 문자열 비교). */
function isDateWithinAllowedRange(value: string): boolean {
  return value >= MIN_ALLOWED_DATE && value <= getMaxAllowedDate();
}

/**
 * 이미 사용한 연차일수 상한(일) — ARCHITECTURE.md "11." 권고. 계산 정확성과 무관한 순수 UX
 * 가드다(FORMULA.md "상식적 범위(예: 365일)" 제안보다 넉넉하게 잡아 정상 입력을 오탐하지
 * 않게 한다).
 */
export const MAX_USED_DAYS = 1000;

/**
 * 1일 통상임금 상한(원) — ARCHITECTURE.md "8." 최악 조합 검토(unusedDays 최대 25 ×
 * ordinaryDailyWage 100억원 = 2.5×10^11, Number.MAX_SAFE_INTEGER 대비 4자리 이상 여유)를
 * 그대로 따른다.
 */
export const MAX_ORDINARY_DAILY_WAGE = 10_000_000_000;

/** ui.tsx의 form 상태처럼, 아직 검증 전이라 모든 필드가 문자열/undefined일 수 있는 원시 입력. */
export interface RawAnnualLeaveAllowanceFormInput {
  hireDate?: string;
  referenceDate?: string;
  usedDays?: string | number;
  ordinaryDailyWage?: string | number;
}

export interface ValidationFieldError {
  field: "hireDate" | "referenceDate" | "usedDays" | "ordinaryDailyWage";
  message: string;
}

export type AnnualLeaveAllowanceValidationResult =
  | { success: true; data: AnnualLeaveAllowanceInput }
  | { success: false; errors: ValidationFieldError[] };

/**
 * 문자열/숫자 입력을 숫자로 정규화한다. 빈 문자열/undefined/null은 undefined(미입력)로,
 * 숫자가 아닌 값은 NaN으로 취급한다(severance-pay `toOptionalNumber`와 동일한 패턴 — 콤마
 * 제거, trim 후 빈 문자열 재확인으로 "공백 문자열이 Number()에서 0이 되는" 함정을 방지한다).
 */
function toOptionalNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const num = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(num) ? num : NaN;
}

/**
 * 연차수당 계산기 입력값을 검증한다. 성공 시 logic.ts(`calculateAnnualLeaveAllowance`)가
 * 바로 받을 수 있는 `AnnualLeaveAllowanceInput`을 반환한다.
 */
export function validateAnnualLeaveAllowanceInput(
  raw: RawAnnualLeaveAllowanceFormInput,
): AnnualLeaveAllowanceValidationResult {
  const errors: ValidationFieldError[] = [];

  // ── hireDate(입사일), referenceDate(연차 산정 기준일) ─────────────────────────
  const hireDate = raw.hireDate?.trim();
  const referenceDate = raw.referenceDate?.trim();

  if (!hireDate) {
    errors.push({ field: "hireDate", message: "입사일을 입력해 주세요." });
  } else if (!isValidIsoDate(hireDate)) {
    errors.push({ field: "hireDate", message: "입사일 형식이 올바르지 않습니다." });
  } else if (!hasPlausibleYearDigits(hireDate) || !isDateWithinAllowedRange(hireDate)) {
    errors.push({ field: "hireDate", message: "입사일 연도를 확인해주세요." });
  }

  if (!referenceDate) {
    errors.push({ field: "referenceDate", message: "연차 산정 기준일을 입력해 주세요." });
  } else if (!isValidIsoDate(referenceDate)) {
    errors.push({
      field: "referenceDate",
      message: "연차 산정 기준일 형식이 올바르지 않습니다.",
    });
  } else if (!hasPlausibleYearDigits(referenceDate) || !isDateWithinAllowedRange(referenceDate)) {
    errors.push({ field: "referenceDate", message: "연차 산정 기준일 연도를 확인해주세요." });
  }

  // FORMULA.md "예외" — hireDate > referenceDate(기준일이 입사일보다 이전)이면 오류.
  // hireDate === referenceDate(입사 당일 조회)는 정상 계산 경로다.
  if (
    hireDate &&
    referenceDate &&
    isValidIsoDate(hireDate) &&
    isValidIsoDate(referenceDate) &&
    referenceDate < hireDate
  ) {
    errors.push({ field: "referenceDate", message: "기준일은 입사일 이후여야 합니다." });
  }

  // ── usedDays(이미 사용한 연차일수) — 선택, 0 이상, 소수(반차) 허용 ──────────────
  const usedDays = toOptionalNumber(raw.usedDays);
  if (usedDays !== undefined) {
    if (Number.isNaN(usedDays)) {
      errors.push({ field: "usedDays", message: "이미 사용한 연차일수는 숫자로 입력해 주세요." });
    } else if (usedDays < 0) {
      errors.push({ field: "usedDays", message: "이미 사용한 연차일수는 0 이상이어야 합니다." });
    } else if (usedDays > MAX_USED_DAYS) {
      errors.push({
        field: "usedDays",
        message: `이미 사용한 연차일수가 너무 큽니다. ${MAX_USED_DAYS.toLocaleString("ko-KR")}일 이하로 입력해 주세요.`,
      });
    }
  }

  // ── ordinaryDailyWage(1일 통상임금) — 선택, 0 이상 ────────────────────────────
  const ordinaryDailyWage = toOptionalNumber(raw.ordinaryDailyWage);
  if (ordinaryDailyWage !== undefined) {
    if (Number.isNaN(ordinaryDailyWage)) {
      errors.push({ field: "ordinaryDailyWage", message: "1일 통상임금은 숫자로 입력해 주세요." });
    } else if (ordinaryDailyWage < 0) {
      errors.push({ field: "ordinaryDailyWage", message: "1일 통상임금은 0 이상이어야 합니다." });
    } else if (ordinaryDailyWage > MAX_ORDINARY_DAILY_WAGE) {
      errors.push({
        field: "ordinaryDailyWage",
        message: `1일 통상임금이 너무 큽니다. ${MAX_ORDINARY_DAILY_WAGE.toLocaleString("ko-KR")}원 이하로 입력해 주세요.`,
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 이 지점에서는 usedDays/ordinaryDailyWage가 NaN이 아니다(NaN이면 위에서 이미 오류 push).
  return {
    success: true,
    data: {
      hireDate: hireDate as string,
      referenceDate: referenceDate as string,
      usedDays,
      ordinaryDailyWage,
    },
  };
}
