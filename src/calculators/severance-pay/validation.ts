/**
 * 퇴직금 계산기 — 입력 검증.
 *
 * tasks/severance-pay/FORMULA.md "입력값" 표 / "예외" 절을 그대로 반영한다.
 * zod 등 스키마 라이브러리는 사용하지 않는다 — 이 프로젝트(package.json)에 zod가
 * 정식 의존성으로 포함되어 있지 않고(peer dependency로만 node_modules에 존재),
 * docs/ARCHITECTURE.md "계산 로직 / UI 분리"가 요구하는 것은 검증 로직의 분리 자체이지
 * 특정 라이브러리 사용이 아니다(docs/CALCULATOR_RULES.md도 "zod 등"이라고 명시해
 * 대안을 허용한다). 순수 TypeScript 검증 함수로 동일한 역할을 수행한다.
 */

import type { SeverancePayInput } from "./types";

/** ui.tsx의 form 상태처럼, 아직 검증 전이라 모든 필드가 문자열/undefined일 수 있는 원시 입력. */
export interface RawSeverancePayFormInput {
  hireDate?: string;
  retireDate?: string;
  /** (v2) 필수 → 선택으로 전환됐다. 미입력이면 undefined — logic.ts가 3단계 우선순위로 판정한다. */
  weeklyScheduledHours?: string | number;
  /**
   * (v2 신규) "주 15시간 미만 근로자입니다" 자진신고 체크박스 값. 폼 상태에서 boolean으로
   * 직접 다루므로(체크박스는 문자열로 직렬화할 필요가 없음) string 변환 없이 그대로 받는다.
   */
  underFifteenHoursDeclared?: boolean;
  wage3m?: string | number;
  bonus12m?: string | number;
  annualLeavePay12m?: string | number;
  ordinaryDailyWage?: string | number;
}

export interface ValidationFieldError {
  field:
    | "hireDate"
    | "retireDate"
    | "weeklyScheduledHours"
    | "wage3m"
    | "bonus12m"
    | "annualLeavePay12m"
    | "ordinaryDailyWage";
  message: string;
}

export type SeverancePayValidationResult =
  | { success: true; data: SeverancePayInput }
  | { success: false; errors: ValidationFieldError[] };

/** FORMULA.md "예외 > 주당 소정근로시간 극단값": 168시간(주 최대 시간) 초과는 상한으로 막는다. */
const MAX_WEEKLY_HOURS = 168;

/**
 * 금액 입력 필드(wage3m/bonus12m/annualLeavePay12m/ordinaryDailyWage)의 상한(원).
 * (2026-09-02 Optimizer 수정 — QA Low 이슈 대응: 상한이 없으면 비현실적 극단값에서
 * Number.isSafeInteger를 벗어나 부동소수점 정밀도가 이론적으로 붕괴할 수 있음이 QA에서
 * 확인됐다.) FORMULA.md는 "정확한 상한 수치는 계산 로직과 무관한 UX 문제이므로 재량"이라고
 * 명시한다 — 계산 정확성과 무관한 안전장치이므로 임의의 값을 재량으로 정한다.
 * 100억원은 대한민국에서 실제로 발생 가능한 3개월 임금총액·상여금·통상임금 등을 수십~수백 배
 * 넘는 여유값이면서도, 안전 정수 범위(2^53 ≈ 9,007조)에는 한참 못 미쳐 이후 전 단위(×100)
 * 스케일링·곱셈을 거쳐도 정밀도가 붕괴하지 않는 크기다.
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

/** "YYYY-MM-DD" 두 날짜를 문자열 그대로 비교해도 안전하다(자릿수가 고정된 ISO 형식이므로). */
function isDateAfter(a: string, b: string): boolean {
  return a > b;
}

/**
 * 입사일/퇴사일 `<input type="date">` 연도 허용 범위.
 * (2026-09-02 Optimizer 수정 — 실사용자 버그 리포트 대응) Chromium 계열 브라우저는
 * `<input type="date">`에 `min`/`max` 속성이 없으면, 연도 서브필드에 키보드로 직접 숫자를
 * 계속 입력해도 4자리를 넘는 입력을 억제하지 않는 알려진 네이티브 동작이 있다(스크린샷 확인:
 * "123411-09-01"처럼 연도가 비정상적으로 길어진 값이 만들어짐). HTML5 date 값 포맷은 4자리
 * 이상의 연도도 문법적으로 "유효한 날짜 문자열"로 허용하므로, 이 파일의 정규식(`ISO_DATE_RE`,
 * 정확히 4자리 연도만 매치)이 그런 값 대부분을 이미 걸러내지만 — "자릿수는 4자리이지만 값
 * 자체가 비현실적인" 케이스(예: `0001-01-01`, `9999-12-31`)까지는 형식 검증만으로 잡을 수
 * 없다. ui.tsx가 추가한 `min`/`max` HTML 속성은 브라우저 UI 힌트일 뿐 실제 값 검증을
 * 보장하지 않으므로(사용자가 여전히 범위 밖 값을 강제로 만들 수 있는 경로가 있을 수 있음),
 * 여기서 파싱된 값 자체를 다시 검증한다.
 *
 * - `MIN_ALLOWED_DATE = "1970-01-01"`: 근로기준법 체계(1953년 제정 이후 수차례 개정을 거쳐
 *   현재의 평균임금·퇴직금 관련 조항이 정착)가 실질적으로 자리 잡은 시기 이후로, 이보다 이른
 *   입사일은 이 계산기가 상정하는 사용 시나리오(현재 시점에 법정 퇴직금 예상액을 확인하려는
 *   근로자)에 해당하지 않는다고 재량으로 판단했다.
 * - `getMaxAllowedDate()`(오늘로부터 1년 후): 퇴사일은 아직 도래하지 않은 예정 퇴사일일 수
 *   있으므로(예: 사직서를 미리 제출하고 미리 계산해보는 경우) 오늘 날짜로 완전히 막지는
 *   않되, 1년을 훌쩍 넘는 먼 미래 날짜는 비현실적인 오입력(연도 자릿수 버그 포함)으로 보아
 *   차단한다.
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

/**
 * 파싱된 연도가 명백히 비정상적인 자릿수(4자리, 1000~9999)를 벗어나지 않는지 확인한다.
 * `ISO_DATE_RE`가 이미 정확히 4자리 연도만 매치하므로 사실상 항상 참이지만, 형식 검증
 * 로직과 독립적으로 값 자체를 방어하기 위한 명시적 안전장치다(연도 자릿수 버그 재발 방지).
 */
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
 * 문자열/숫자 입력을 숫자로 정규화한다. 빈 문자열/undefined/NaN은 undefined로 취급한다.
 * (2026-09-02 Optimizer 수정 — Critic Medium M2 대응) ui.tsx가 금액 입력 필드에 실시간 천 단위
 * 콤마를 표시하게 되면서, 여기 도달하는 문자열에 "9,200,000"처럼 콤마가 포함될 수 있다.
 * 콤마는 숫자 표현이 아니라 표시 형식이므로 파싱 전에 제거한다 — 검증/계산 로직 자체는 바뀌지
 * 않는다.
 * (2026-09-02 Optimizer 수정 v2 — QA v2 재검증 Medium 대응) 문자열은 반드시 먼저 `.trim()`한다.
 * hireDate/retireDate가 이미 쓰는 것과 동일한 패턴이다. trim 없이는 공백만 있는 문자열
 * (`"   "`)이 세 조건(undefined/null/"") 어디에도 걸리지 않고 그대로 `Number("   ")`로
 * 넘어가는데, JS의 `Number()`는 공백 문자열을 `NaN`이 아니라 `0`으로 반환하는 특이 동작이
 * 있다 — 그 결과 "미입력"이어야 할 값이 "숫자 0 입력"으로 조용히 둔갑해 오판정을 일으킬 수
 * 있었다(weeklyScheduledHours 필드에서 실제로 도달 가능한 경로였음, QA v2 재검증 참고).
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
  return Number.isFinite(num) ? num : NaN; // NaN을 그대로 전달해 "숫자가 아님" 오류로 잡히게 한다.
}

/**
 * 필수 정수 금액/시간 필드 하나를 검증한다.
 * @param allowDecimal weeklyScheduledHours는 소수 허용(FORMULA.md: "시간(정수/소수 모두 허용)").
 */
function validateRequiredAmount(
  field: ValidationFieldError["field"],
  label: string,
  raw: string | number | undefined,
  errors: ValidationFieldError[],
  options: { allowDecimal?: boolean; max?: number } = {},
): number | undefined {
  const num = toOptionalNumber(raw);
  if (num === undefined) {
    errors.push({ field, message: `${label}을(를) 입력해 주세요.` });
    return undefined;
  }
  if (Number.isNaN(num)) {
    errors.push({ field, message: `${label}은(는) 숫자여야 합니다.` });
    return undefined;
  }
  if (num < 0) {
    errors.push({ field, message: `${label}은(는) 0 이상이어야 합니다.` });
    return undefined;
  }
  if (!options.allowDecimal && !Number.isInteger(num)) {
    errors.push({ field, message: `${label}은(는) 정수여야 합니다.` });
    return undefined;
  }
  if (options.max !== undefined && num > options.max) {
    errors.push({
      field,
      message: `${label}은(는) ${options.max} 이하여야 합니다.`,
    });
    return undefined;
  }
  return num;
}

/**
 * 선택 입력(0 이상, 미입력 시 undefined) 필드 하나를 검증한다.
 * @param allowDecimal 기본은 정수만 허용(금액 필드). weeklyScheduledHours처럼 소수를 허용해야
 * 하는 선택 필드는 true로 지정한다(FORMULA.md: "시간(정수/소수 모두 허용)").
 */
function validateOptionalAmount(
  field: ValidationFieldError["field"],
  label: string,
  raw: string | number | undefined,
  errors: ValidationFieldError[],
  options: { max?: number; allowDecimal?: boolean } = {},
): number | undefined {
  const num = toOptionalNumber(raw);
  if (num === undefined) return undefined;
  if (Number.isNaN(num)) {
    errors.push({ field, message: `${label}은(는) 숫자여야 합니다.` });
    return undefined;
  }
  if (num < 0) {
    errors.push({ field, message: `${label}은(는) 0 이상이어야 합니다.` });
    return undefined;
  }
  if (!options.allowDecimal && !Number.isInteger(num)) {
    errors.push({ field, message: `${label}은(는) 정수여야 합니다.` });
    return undefined;
  }
  if (options.max !== undefined && num > options.max) {
    errors.push({
      field,
      message: `${label}은(는) ${options.max.toLocaleString("ko-KR")} 이하여야 합니다.`,
    });
    return undefined;
  }
  return num;
}

/**
 * 퇴직금 계산기 입력값을 검증한다.
 * 성공 시 logic.ts(calculateSeverancePay)가 바로 받을 수 있는 SeverancePayInput을 반환한다.
 */
export function validateSeverancePayInput(
  raw: RawSeverancePayFormInput,
): SeverancePayValidationResult {
  const errors: ValidationFieldError[] = [];

  // 날짜: 필수, 형식/존재 여부, 순서(retireDate > hireDate).
  const hireDate = raw.hireDate?.trim();
  const retireDate = raw.retireDate?.trim();

  if (!hireDate) {
    errors.push({ field: "hireDate", message: "입사일을 입력해 주세요." });
  } else if (!isValidIsoDate(hireDate)) {
    errors.push({
      field: "hireDate",
      message: "입사일 형식이 올바르지 않습니다.",
    });
  } else if (
    !hasPlausibleYearDigits(hireDate) ||
    !isDateWithinAllowedRange(hireDate)
  ) {
    // (2026-09-02 Optimizer 수정 — 연도 자릿수 버그 대응) 형식(YYYY-MM-DD)은 맞지만 연도
    // 값 자체가 비현실적인 경우(브라우저 네이티브 date input 버그로 만들어진 값 포함).
    errors.push({
      field: "hireDate",
      message: "입사일 연도를 확인해주세요.",
    });
  }

  if (!retireDate) {
    errors.push({ field: "retireDate", message: "퇴사일을 입력해 주세요." });
  } else if (!isValidIsoDate(retireDate)) {
    errors.push({
      field: "retireDate",
      message: "퇴사일 형식이 올바르지 않습니다.",
    });
  } else if (
    !hasPlausibleYearDigits(retireDate) ||
    !isDateWithinAllowedRange(retireDate)
  ) {
    errors.push({
      field: "retireDate",
      message: "퇴사일 연도를 확인해주세요.",
    });
  }

  if (
    hireDate &&
    retireDate &&
    isValidIsoDate(hireDate) &&
    isValidIsoDate(retireDate) &&
    !isDateAfter(retireDate, hireDate)
  ) {
    errors.push({
      field: "retireDate",
      message: "퇴사일은 입사일보다 늦어야 합니다.",
    });
  }

  // (v2, FORMULA.md "주당 소정근로시간 기본값 정책") 필수 → 선택으로 전환. 미입력이면 undefined —
  // logic.ts가 underFifteenHoursDeclared와 함께 3단계 우선순위로 판정한다. 실제로 숫자를 입력한
  // 경우에는 종전과 동일하게 0 이상 168 이하(소수 허용)로 검증한다.
  const weeklyScheduledHours = validateOptionalAmount(
    "weeklyScheduledHours",
    "주당 소정근로시간",
    raw.weeklyScheduledHours,
    errors,
    { allowDecimal: true, max: MAX_WEEKLY_HOURS },
  );

  const wage3m = validateRequiredAmount(
    "wage3m",
    "퇴사일 이전 3개월 임금총액",
    raw.wage3m,
    errors,
    { max: MAX_AMOUNT_WON },
  );

  const bonus12m = validateOptionalAmount(
    "bonus12m",
    "퇴사일 이전 12개월 상여금 총액",
    raw.bonus12m,
    errors,
    { max: MAX_AMOUNT_WON },
  );

  const annualLeavePay12m = validateOptionalAmount(
    "annualLeavePay12m",
    "퇴사일 이전 12개월 연차수당 총액",
    raw.annualLeavePay12m,
    errors,
    { max: MAX_AMOUNT_WON },
  );

  const ordinaryDailyWage = validateOptionalAmount(
    "ordinaryDailyWage",
    "1일 통상임금",
    raw.ordinaryDailyWage,
    errors,
    { max: MAX_AMOUNT_WON },
  );

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 이 지점에서는 위 검증을 모두 통과했으므로 필수값들은 정의되어 있다.
  return {
    success: true,
    data: {
      hireDate: hireDate as string,
      retireDate: retireDate as string,
      weeklyScheduledHours,
      underFifteenHoursDeclared:
        raw.underFifteenHoursDeclared === true ? true : undefined,
      wage3m: wage3m as number,
      bonus12m,
      annualLeavePay12m,
      ordinaryDailyWage,
    },
  };
}
