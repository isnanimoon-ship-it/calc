/**
 * 주휴수당 계산기 — 입력 검증.
 *
 * ⚠️ Architect 스캐폴딩 단계다 — `validateWeeklyHolidayAllowanceInput`의 본문은 Builder가
 * tasks/weekly-holiday-allowance/FORMULA.md "입력값" 표 / "예외" 절, SPEC.md "입력 오류/극단값
 * 방어"를 그대로 구현한다. severance-pay / unemployment-benefit의 순수 TypeScript 검증 함수
 * 패턴을 따른다(zod 미사용 — 이 프로젝트에 정식 의존성이 아니다, severance-pay/validation.ts
 * 주석 참고).
 *
 * 이 계산기에는 **차단(blocking) 대상이 아닌 것**이 두 가지 있다(SPEC "설계상 핵심 결정",
 * FORMULA.md "예외") — validation에서 오류로 처리하지 않는다:
 *  - `weeklyHours < 15` (초단시간): 계산은 그대로 진행하고 logic 결과의
 *    `meetsMinHoursRequirement=false`로 UI가 경고만 표시한다.
 *  - `weeklyHours > 40` (연장): 오류 아님. logic이 주휴시간을 8시간으로 상한 처리한다.
 *  - `hourlyWage < 최저임금`: 오류 아님. logic 결과의 `belowMinimumWage=true`로 경고만.
 * validation이 막는 것은 순수 입력 오류(빈 값 / 0 / 음수 / 숫자 아님 / 상한 초과)뿐이다.
 */

import type { WeeklyHolidayAllowanceInput } from "./types";

/** ui.tsx의 form 상태처럼, 아직 검증 전이라 필드가 문자열/undefined일 수 있는 원시 입력. */
export interface RawWeeklyHolidayAllowanceFormInput {
  /** 시급(원). 금액 입력이라 실시간 천 단위 콤마가 포함될 수 있다(파싱 전 콤마 제거). */
  hourlyWage?: string | number;
  /** 1주 근무시간(시간). 0.5 단위 소수 허용. */
  weeklyHours?: string | number;
}

export interface ValidationFieldError {
  field: "hourlyWage" | "weeklyHours";
  message: string;
}

export type WeeklyHolidayAllowanceValidationResult =
  | { success: true; data: WeeklyHolidayAllowanceInput }
  | { success: false; errors: ValidationFieldError[] };

/**
 * 1주 근무시간 상한(시간). FORMULA.md "입력값": `<= 168` (1주 = 168시간 초과 불가).
 * 40 초과는 오류가 아니라는 점에 주의 — 상한은 어디까지나 물리적으로 불가능한 값 방어용.
 */
export const MAX_WEEKLY_HOURS = 168;

/**
 * 시급 상한(원). FORMULA.md "입력값"이 예로 든 1,000,000원 — 계산 정확성과 무관한 극단값
 * 방어다(정확한 값은 Architect/Builder 재량). severance-pay / unemployment-benefit의
 * `MAX_AMOUNT_WON`(100억)보다 훨씬 낮게 잡는다: 여기서 받는 값은 "3개월 임금총액"이 아니라
 * "시간당 임금"이라 상식적 상한이 훨씬 작다(국내 최고 수준 전문직 시급도 수십만 원대).
 */
export const MAX_HOURLY_WAGE = 1_000_000;

/**
 * 한글 조사(은/는, 을/를)를 라벨 마지막 글자의 받침 유무에 맞춰 고른다.
 * severance-pay / unemployment-benefit validation.ts의 `hasFinalConsonant` / `particle`와
 * 동일한 패턴(유니코드 한글 음절 코드포인트를 28로 나눈 나머지로 종성 유무 판정)이다.
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
 * 10진수 숫자 문자열만 허용하는 패턴. `Number("0x10")`=16, `Number("1e7")`=1e7 처럼 16진수·
 * 지수 표기가 조용히 통과하는 것을 막는다(QA-L3). 정수·소수·부호·"10." / ".5" 형태는 허용한다.
 * severance-pay / unemployment-benefit은 이 방어가 없는 기존 패턴이며 이번 라운드에서 건드리지
 * 않는다 — 이 계산기 안에서만 좁혀 막는다.
 */
const DECIMAL_NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * 문자열/숫자 입력을 숫자로 정규화한다. 빈 문자열/undefined/NaN은 undefined로 취급한다.
 * severance-pay / unemployment-benefit validation.ts의 `toOptionalNumber`와 같은 패턴에,
 * 10진수 표기 검사만 추가했다(위 `DECIMAL_NUMBER_RE`). 반드시 먼저 `.trim()`한다(공백만 있는
 * 문자열이 `Number("  ")`에 의해 조용히 0으로 둔갑하는 것을 막는다). 금액 입력의 실시간 천
 * 단위 콤마는 파싱 전에 제거한다.
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
  const cleaned = trimmed.replace(/,/g, "");
  if (!DECIMAL_NUMBER_RE.test(cleaned)) return NaN; // "0x10" / "1e7" / "abc" 등 → "숫자가 아님" 오류로.
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN; // NaN은 그대로 전달해 "숫자가 아님" 오류로 잡히게 한다.
}

/**
 * 필수 양수 필드 하나를 검증한다.
 * @param options.integer true면 정수만 허용(시급). weeklyHours는 소수를 허용하므로 false.
 */
function validateRequiredPositive(
  field: ValidationFieldError["field"],
  label: string,
  raw: string | number | undefined,
  errors: ValidationFieldError[],
  options: {
    integer?: boolean;
    max: number;
    /** 상한 초과 오류 메시지에서 숫자 뒤에 붙일 단위(예: "원", "시간"). UX/UI Critic L5. */
    maxUnit?: string;
    /** 상한 초과 오류 메시지 끝에 덧붙일 근거 한 조각(예: "1주는 168시간입니다"). */
    maxNote?: string;
  },
): number | undefined {
  const num = toOptionalNumber(raw);
  if (num === undefined) {
    errors.push({
      field,
      message: `${label}${particle(label, "을", "를")} 입력해 주세요.`,
    });
    return undefined;
  }
  if (Number.isNaN(num)) {
    errors.push({
      field,
      message: `${label}${particle(label, "은", "는")} 숫자로 입력해 주세요.`,
    });
    return undefined;
  }
  if (num <= 0) {
    errors.push({
      field,
      message: `${label}${particle(label, "은", "는")} 0보다 커야 합니다.`,
    });
    return undefined;
  }
  if (options.integer && !Number.isInteger(num)) {
    errors.push({
      field,
      message: `${label}${particle(label, "은", "는")} 정수로 입력해 주세요.`,
    });
    return undefined;
  }
  if (num > options.max) {
    const limit = `${options.max.toLocaleString("ko-KR")}${options.maxUnit ?? ""}`;
    const base = `${label}${particle(label, "은", "는")} ${limit} 이하로 입력해 주세요.`;
    errors.push({
      field,
      message: options.maxNote ? `${base} (${options.maxNote})` : base,
    });
    return undefined;
  }
  return num;
}

/**
 * 주휴수당 계산기 입력값을 검증한다. FORMULA.md "입력값" 표 + "예외" 절.
 * 성공 시 logic.ts(`calculateWeeklyHolidayAllowance`)가 바로 받을 수 있는
 * `WeeklyHolidayAllowanceInput`을 반환한다.
 *
 * - `hourlyWage`("시급"): 필수, 숫자, **정수만**, `> 0`, `<= MAX_HOURLY_WAGE`.
 * - `weeklyHours`("주 근무시간"): 필수, 숫자, **소수 허용**(0.5 배수 강제 안 함), `> 0`,
 *   `<= MAX_WEEKLY_HOURS`(168).
 * - 15시간 미만 / 40시간 초과 / 최저임금 미만은 **오류가 아니다** — 계산은 그대로 진행하고
 *   경고는 결과 플래그(`meetsMinHoursRequirement` / `belowMinimumWage`)로만 전달한다
 *   (SPEC "설계상 핵심 결정", FORMULA.md "예외").
 */
export function validateWeeklyHolidayAllowanceInput(
  raw: RawWeeklyHolidayAllowanceFormInput,
): WeeklyHolidayAllowanceValidationResult {
  const errors: ValidationFieldError[] = [];

  const hourlyWage = validateRequiredPositive(
    "hourlyWage",
    "시급",
    raw.hourlyWage,
    errors,
    { integer: true, max: MAX_HOURLY_WAGE, maxUnit: "원" },
  );

  const weeklyHours = validateRequiredPositive(
    "weeklyHours",
    "주 근무시간",
    raw.weeklyHours,
    errors,
    {
      max: MAX_WEEKLY_HOURS,
      maxUnit: "시간",
      maxNote: `1주는 ${MAX_WEEKLY_HOURS}시간입니다`,
    },
  );

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      hourlyWage: hourlyWage as number,
      weeklyHours: weeklyHours as number,
    },
  };
}
