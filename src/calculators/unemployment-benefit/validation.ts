/**
 * 실업급여(구직급여) 계산기 — 입력 검증.
 *
 * tasks/unemployment-benefit/FORMULA.md "입력값" 표 / "예외 > 입력 오류" 절, SPEC.md
 * "입력 오류/극단값 방어"를 그대로 반영한다. severance-pay/validation.ts와 동일한 순수
 * TypeScript 검증 함수 패턴을 따른다(zod 미사용 이유는 severance-pay/validation.ts 주석 참고
 * — 이 프로젝트에 zod가 정식 의존성이 아니다).
 *
 * **주의**: `insuredPeriodDays < 180`(피보험단위기간 180일 미만)은 여기서 "검증 오류"로
 * 다루지 않는다 — SPEC.md/FORMULA.md는 이를 "수급자격 요건 미충족" 안내로 별도 처리하도록
 * 명시했고(logic.ts의 `calculateUnemploymentBenefit`이 `eligible: false`를 반환), 이는
 * 입력 자체가 잘못된 것이 아니라 정상적으로 계산 가능한 값이기 때문이다.
 *
 * (2026-09-02 Optimizer 수정 — UX/UI Critic High 대응) `insuredPeriodDays`는 더 이상 사용자가
 * 직접 입력하는 필드가 아니다 — 사용자는 "입사일"(`insuredStartDate`)만 입력하고,
 * 이 파일이 `leaveDate`와의 날짜 차이(`src/lib/date-calc.ts`의 `diffDaysUtc`)를 계산해
 * `insuredPeriodDays`를 채운다(음수가 나오지 않도록 "입사일 ≤ 퇴사일" 순서는 아래에서 별도
 * 검증한다). 0 이상이라는 성질은 이 순서 검증에서 자동으로 보장되므로, 더 이상 별도의
 * "0 이상 정수" 숫자 입력 검증은 필요하지 않다.
 */

import { diffDaysUtc, parseIsoDateUtc } from "@/src/lib/date-calc";
import type { UnemploymentBenefitCalcInput } from "./types";

/** ui.tsx의 form 상태처럼, 아직 검증 전이라 모든 필드가 문자열/undefined일 수 있는 원시 입력. */
export interface RawUnemploymentBenefitFormInput {
  ageAtLeave?: string | number;
  leaveDate?: string;
  /**
   * 입사일(퇴사일 기준 연속 고용보험 가입 시작일). (2026-09-02 Optimizer 수정 — UX/UI
   * Critic High 대응) 종전 `insuredPeriodDays`(사용자가 직접 암산해 입력하는 누적 일수)를
   * 대체한다 — 아래 `validateUnemploymentBenefitInput`이 이 값과 `leaveDate`로부터
   * `insuredPeriodDays`를 자동 계산한다(types.ts `UnemploymentBenefitFormInput.insuredStartDate`
   * 주석 참고).
   */
  insuredStartDate?: string;
  isUltraShortTimeWorker?: boolean;
  isDisabled?: boolean;
  wage3m?: string | number;
}

export interface ValidationFieldError {
  field: "ageAtLeave" | "leaveDate" | "insuredStartDate" | "wage3m";
  message: string;
}

export type UnemploymentBenefitValidationResult =
  | { success: true; data: UnemploymentBenefitCalcInput }
  | { success: false; errors: ValidationFieldError[] };

/**
 * 만 나이 허용 범위. FORMULA.md "입력값" 표: "15~100 정도의 상식적 범위(정확한 상한은
 * Architect/Builder 재량)". 15세는 근로기준법상 원칙적 최저 취업연령(제64조)과도 맞닿아
 * 있어 하한으로 합리적이고, 100세는 실질적으로 발생 가능한 범위를 넉넉히 덮으면서도
 * 비현실적인 오입력(자릿수 오류 등)을 걸러낼 수 있는 상한이다.
 */
const MIN_AGE = 15;
const MAX_AGE = 100;

/**
 * 금액 입력(wage3m) 상한(원). severance-pay/validation.ts의 `MAX_AMOUNT_WON`과 동일한
 * 근거(비현실적 극단값에서 부동소수점 정밀도 붕괴 방지) — 100억원은 실제 발생 가능한
 * 3개월 임금총액을 수십~수백 배 넘는 여유값이면서 안전 정수 범위에는 한참 못 미친다.
 */
const MAX_AMOUNT_WON = 10_000_000_000; // 100억원

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
 * 퇴사일 `<input type="date">` 연도 허용 범위. severance-pay/validation.ts의
 * `MIN_ALLOWED_DATE`/`getMaxAllowedDate()`와 동일한 근거(Chromium 계열 브라우저의 연도
 * 자릿수 버그 방어, docs/DESIGN_SYSTEM.md "날짜 입력") — 이 계산기도 동일 규칙을 그대로
 * 적용한다(작업 지시). 최솟값은 고용보험법 체계가 정착한 시기 이후로 severance-pay와 동일하게
 * 잡았고, 최댓값은 "예정 퇴사일"을 미리 계산해보는 경우를 허용하되(오늘 기준 1년 후) 비현실적인
 * 먼 미래 날짜(자릿수 버그 포함)는 차단한다.
 */
export const MIN_ALLOWED_DATE = "1970-01-01";

/** 오늘 기준 1년 후 날짜를 "YYYY-MM-DD"로 반환한다(위 `MIN_ALLOWED_DATE` 설명 참고). */
export function getMaxAllowedDate(): string {
  const now = new Date();
  const max = new Date(
    Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()),
  );
  return max.toISOString().slice(0, 10);
}

/** 파싱된 연도가 4자리(1000~9999) 범위인지 방어적으로 확인한다(연도 자릿수 버그 재발 방지). */
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
 * 한글 조사(은/는, 을/를)를 라벨의 마지막 글자 받침 유무에 맞춰 고른다.
 *
 * (2026-09-02 Optimizer 수정 — UX/UI Critic Low 대응) 종전에는 모든 오류 메시지가
 * "${label}은(는) ..." / "${label}을(를) ..."처럼 두 조사를 괄호로 병기해 기계적으로
 * 이어붙였다 — "현재 만 나이은(는) 정수여야 합니다"처럼 받침 없는 라벨("나이") 뒤에도
 * "은(는)"이 그대로 붙어 "나이은는"으로 읽히는 부자연스러움이 있었다. 유니코드 한글 음절
 * 코드포인트(`U+AC00`~`U+D7A3`)는 `(초성×21+중성)×28+종성`으로 배열되어 있어, 코드포인트를
 * 28로 나눈 나머지가 0이면 받침(종성)이 없다는 뜻이다 — 이 성질로 실제 받침 유무를 계산해
 * 올바른 조사 하나만 고른다. 한글 음절이 아닌 문자(숫자·영문 등)로 끝나는 라벨은 방어적으로
 * "받침 있음" 쪽(자연스러운 기본값)으로 처리한다.
 */
function hasFinalConsonant(char: string): boolean {
  const code = char.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return true; // 한글 음절이 아니면 방어적으로 받침 있음 취급
  return code % 28 !== 0;
}

/** `label`의 마지막 글자 받침 유무에 따라 `withFinal`/`withoutFinal` 조사 중 하나를 고른다. */
function particle(label: string, withFinal: string, withoutFinal: string): string {
  const lastChar = label.at(-1) ?? "";
  return hasFinalConsonant(lastChar) ? withFinal : withoutFinal;
}

/**
 * 문자열/숫자 입력을 숫자로 정규화한다. 빈 문자열/undefined/NaN은 undefined로 취급한다.
 * severance-pay/validation.ts의 `toOptionalNumber`와 동일한 패턴(콤마 제거, trim 처리 포함
 * — 공백 문자열이 `Number()`에 의해 조용히 0으로 둔갑하는 것을 막기 위해 반드시 먼저 trim한다).
 */
function toOptionalNumber(
  value: string | number | undefined,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const num = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(num) ? num : NaN;
}

/** 필수 정수 필드 하나를 검증한다(0 이상, 정수, 선택적 상한). */
function validateRequiredInteger(
  field: ValidationFieldError["field"],
  label: string,
  raw: string | number | undefined,
  errors: ValidationFieldError[],
  options: { min?: number; max?: number } = {},
): number | undefined {
  const num = toOptionalNumber(raw);
  if (num === undefined) {
    errors.push({ field, message: `${label}${particle(label, "을", "를")} 입력해 주세요.` });
    return undefined;
  }
  if (Number.isNaN(num)) {
    errors.push({ field, message: `${label}${particle(label, "은", "는")} 숫자여야 합니다.` });
    return undefined;
  }
  if (!Number.isInteger(num)) {
    errors.push({ field, message: `${label}${particle(label, "은", "는")} 정수여야 합니다.` });
    return undefined;
  }
  const min = options.min ?? 0;
  if (num < min) {
    errors.push({
      field,
      message: `${label}${particle(label, "은", "는")} ${min} 이상이어야 합니다.`,
    });
    return undefined;
  }
  if (options.max !== undefined && num > options.max) {
    errors.push({
      field,
      message: `${label}${particle(label, "은", "는")} ${options.max.toLocaleString("ko-KR")} 이하여야 합니다.`,
    });
    return undefined;
  }
  return num;
}

/**
 * 실업급여 계산기 입력값을 검증한다.
 * 성공 시 logic.ts(calculateUnemploymentBenefit)가 바로 받을 수 있는
 * UnemploymentBenefitCalcInput을 반환한다.
 */
export function validateUnemploymentBenefitInput(
  raw: RawUnemploymentBenefitFormInput,
): UnemploymentBenefitValidationResult {
  const errors: ValidationFieldError[] = [];

  // 퇴사일: 필수, 형식/존재 여부, 허용 범위(연도 자릿수 방어 포함).
  const leaveDate = raw.leaveDate?.trim();
  if (!leaveDate) {
    errors.push({ field: "leaveDate", message: "퇴사일을 입력해 주세요." });
  } else if (!isValidIsoDate(leaveDate)) {
    errors.push({
      field: "leaveDate",
      message: "퇴사일 형식이 올바르지 않습니다.",
    });
  } else if (
    !hasPlausibleYearDigits(leaveDate) ||
    !isDateWithinAllowedRange(leaveDate)
  ) {
    errors.push({
      field: "leaveDate",
      message: "퇴사일 연도를 확인해주세요.",
    });
  }

  // 연령: 필수, 정수, 15~100 상식적 범위.
  const ageAtLeave = validateRequiredInteger(
    "ageAtLeave",
    "현재 만 나이",
    raw.ageAtLeave,
    errors,
    { min: MIN_AGE, max: MAX_AGE },
  );

  // 입사일: 필수, 형식/존재 여부, 허용 범위(leaveDate와 동일 규칙),
  // 퇴사일보다 늦지 않아야 함. (2026-09-02 Optimizer 수정 — UX/UI Critic High 대응) 종전
  // "고용보험 가입기간(일)"을 사용자가 직접 암산해 입력하던 필드를 이 날짜 입력으로 대체했다
  // (types.ts `UnemploymentBenefitFormInput.insuredStartDate` 주석 참고). 아래에서 leaveDate와
  // 함께 `insuredPeriodDays`(일수)를 자동 계산한다 — 180일 미만은 (종전과 동일하게) 여기서
  // 오류로 처리하지 않는다(logic.ts가 "수급자격 요건 미충족"으로 별도 처리).
  const insuredStartDate = raw.insuredStartDate?.trim();
  if (!insuredStartDate) {
    errors.push({
      field: "insuredStartDate",
      message: "입사일을 입력해 주세요.",
    });
  } else if (!isValidIsoDate(insuredStartDate)) {
    errors.push({
      field: "insuredStartDate",
      message: "입사일 형식이 올바르지 않습니다.",
    });
  } else if (
    !hasPlausibleYearDigits(insuredStartDate) ||
    !isDateWithinAllowedRange(insuredStartDate)
  ) {
    errors.push({
      field: "insuredStartDate",
      message: "입사일 연도를 확인해주세요.",
    });
  } else if (
    leaveDate &&
    isValidIsoDate(leaveDate) &&
    insuredStartDate > leaveDate
  ) {
    // ISO(YYYY-MM-DD) 문자열은 자릿수가 고정돼 있어 사전식 비교가 곧 날짜 비교다
    // (severance-pay/validation.ts `isDateAfter` 패턴 참고). 입사일과 퇴사일이 같은 날인
    // 경우(가입기간 0일)는 허용한다 — 그 결과는 자연스럽게 "수급자격 요건 미충족"으로 이어진다.
    errors.push({
      field: "insuredStartDate",
      message: "입사일은 퇴사일보다 늦을 수 없습니다.",
    });
  }

  // 두 날짜가 모두 유효한 형식이고 순서 오류가 없을 때만 일수를 계산한다 — 형식이 깨진 날짜를
  // date-calc.ts에 넘기지 않기 위해서다(diffDaysUtc 자체는 Date 객체를 받으므로 문자열 파싱은
  // parseIsoDateUtc가 담당한다). 이 지점에서 계산된 값은 아래 "errors.length > 0" 체크를
  // 통과한 뒤에만 실제로 쓰인다.
  let insuredPeriodDays: number | undefined;
  if (
    insuredStartDate &&
    leaveDate &&
    isValidIsoDate(insuredStartDate) &&
    isValidIsoDate(leaveDate) &&
    insuredStartDate <= leaveDate
  ) {
    const start = parseIsoDateUtc(insuredStartDate);
    const end = parseIsoDateUtc(leaveDate);
    if (start && end) {
      insuredPeriodDays = diffDaysUtc(start, end);
    }
  }

  // 3개월 임금총액: 필수, 정수, 0 이상.
  const wage3m = validateRequiredInteger(
    "wage3m",
    "퇴사 전 3개월 임금총액",
    raw.wage3m,
    errors,
    { min: 0, max: MAX_AMOUNT_WON },
  );

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      leaveDate: leaveDate as string,
      ageAtLeave: ageAtLeave as number,
      insuredPeriodDays: insuredPeriodDays as number,
      isUltraShortTimeWorker:
        raw.isUltraShortTimeWorker === true ? true : undefined,
      isDisabled: raw.isDisabled === true ? true : undefined,
      wage3m: wage3m as number,
    },
  };
}
