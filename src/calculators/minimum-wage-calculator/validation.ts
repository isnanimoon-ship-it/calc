/**
 * 최저임금·시급↔월급 계산기 — 입력 검증.
 *
 * FORMULA.md "입력값" 표 / "예외" 절, SPEC.md "입력 오류/극단값 방어"를 그대로 구현한다.
 * severance-pay / weekly-holiday-allowance의 순수 TypeScript 검증 함수 패턴을 따른다
 * (zod 미사용 — 이 프로젝트에 정식 의존성이 아니다).
 *
 * 이 계산기 고유의 결정 두 가지(ARCHITECTURE.md "4.", "10."):
 * 1. **`weeklyHours` 하한을 FORMULA.md 원안(`> 0`)보다 좁혀 `MIN_WEEKLY_HOURS(1)`로 둔다.**
 *    `weeklyHours`가 아주 작으면(약 0.096 미만) 이 계산기가 채택한 "월 환산 시간을 정수로
 *    반올림 후 재사용"하는 정책 때문에 `monthlyEquivalentHours`가 0으로 무너져 월급 모드에서
 *    0 나눗셈(`Infinity`)이, 시급 모드에서 `환산 월급 = 0`이라는 명백히 잘못된 결과가
 *    나온다(ARCHITECTURE.md "4." 참고). FORMULA.md D1 예제(`weeklyHours=1`)는 이 하한을
 *    그대로 검증한다.
 * 2. **`weeklyHours`는 선택 입력이며 빈 값이면 기본값 40(법정 기준근로시간)을 적용한다**
 *    (SPEC "공통 입력: 주 근무시간(선택, 기본값 40시간)", ARCHITECTURE.md "10." — 기본값
 *    적용은 validation.ts 책임이며 `types.ts`에 도달한 시점엔 이미 확정된 숫자다).
 *
 * `hourlyWage`/`monthlyWage`는 weekly-holiday-allowance와 동일한 이유로 **정수만 허용**한다
 * (국내 시급·최저임금·채용공고·급여명세서가 전부 원 단위 정수). FORMULA.md 예제 E1(소수 시급
 * 10,320.5)은 이 정수 제한과 충돌하므로 UI/validation 레벨에서는 거부 대상이지만, 그 예제의
 * 목적("반올림 공식 자체가 소수 입력에도 올바르게 동작하는지")은 `logic.ts`의
 * `calculateFromHourlyWage`를 직접 호출하는 단위 테스트로 별도 검증한다(ARCHITECTURE.md
 * "10.", logic.test.ts 참고).
 */

import type { MinimumWageCalculatorInput } from "./types";

/** ui.tsx의 form 상태처럼, 아직 검증 전이라 필드가 문자열/undefined일 수 있는 원시 입력. */
export interface RawMinimumWageCalculatorFormInput {
  /** "HOURLY" | "MONTHLY" 중 하나여야 한다. 그 외 값(빈 문자열 포함)은 오류로 처리한다. */
  mode?: string;
  /** 시급(원). `mode="HOURLY"`일 때만 검증 대상이다. 실시간 천 단위 콤마가 포함될 수 있다. */
  hourlyWage?: string | number;
  /** 월급(원). `mode="MONTHLY"`일 때만 검증 대상이다. */
  monthlyWage?: string | number;
  /** 주 근무시간(시간). 비워두면 기본값 40이 적용된다(선택 입력). */
  weeklyHours?: string | number;
}

export interface ValidationFieldError {
  field: "mode" | "hourlyWage" | "monthlyWage" | "weeklyHours";
  message: string;
}

export type MinimumWageCalculatorValidationResult =
  | { success: true; data: MinimumWageCalculatorInput }
  | { success: false; errors: ValidationFieldError[] };

/**
 * 1주 근무시간 상한(시간). FORMULA.md "입력값": `<= 168`(weekly-holiday-allowance와 동일한
 * 판단 기준 재사용 — 1주는 물리적으로 168시간을 초과할 수 없다).
 */
export const MAX_WEEKLY_HOURS = 168;

/**
 * 1주 근무시간 하한(시간). FORMULA.md 원안은 `> 0`이지만, Architect가 이 계산기 고유의 반올림
 * 정책(월 환산 시간을 정수로 반올림 후 재사용)과 결합했을 때 발생하는 0 나눗셈/0 환산 버그를
 * 방지하기 위해 `1`로 좁혔다(ARCHITECTURE.md "4." — 임계값은 약 0.096이며, 1은 그보다 10배
 * 이상 여유가 있고 FORMULA.md D1 예제가 이미 정상 동작을 검증한 값이다).
 */
export const MIN_WEEKLY_HOURS = 1;

/** 주 근무시간을 비워 두었을 때 적용하는 기본값(법정 기준근로시간, SPEC "선택, 기본값 40시간"). */
export const DEFAULT_WEEKLY_HOURS = 40;

/**
 * 시급 상한(원). weekly-holiday-allowance의 `MAX_HOURLY_WAGE`와 동일한 근거·동일한 값 —
 * "시간당 임금"이라는 성격상 국내 최고 수준 전문직 시급도 수십만 원대에 그친다.
 */
export const MAX_HOURLY_WAGE = 1_000_000;

/**
 * 월급 상한(원). FORMULA.md "입력값"이 예로 든 10억 원 — 계산 정확성과 무관한 극단값
 * 방어다(정확한 값은 Architect/Builder 재량).
 */
export const MAX_MONTHLY_WAGE = 1_000_000_000;

/**
 * 한글 조사(은/는, 을/를)를 라벨 마지막 글자의 받침 유무에 맞춰 고른다.
 * severance-pay / weekly-holiday-allowance validation.ts의 `hasFinalConsonant` / `particle`와
 * 동일한 패턴(각 계산기가 독립적으로 재정의 — ARCHITECTURE.md "10." cross-import 금지 관례).
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
 * 지수 표기가 조용히 통과하는 것을 막는다. 정수·소수·부호·"10." / ".5" 형태는 허용한다.
 */
const DECIMAL_NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * 문자열/숫자 입력을 숫자로 정규화한다. 빈 문자열/undefined/NaN은 undefined로 취급한다.
 * 반드시 먼저 `.trim()`한다(공백만 있는 문자열이 `Number("  ")`에 의해 조용히 0으로 둔갑하는
 * 것을 막는다). 금액 입력의 실시간 천 단위 콤마는 파싱 전에 제거한다.
 */
function toOptionalNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const cleaned = trimmed.replace(/,/g, "");
  if (!DECIMAL_NUMBER_RE.test(cleaned)) return NaN; // "0x10" / "1e7" / "abc" 등 → "숫자가 아님" 오류로.
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

/**
 * 필수 양수 금액 필드 하나를 검증한다(시급/월급 공용). **정수만 허용**한다
 * (weekly-holiday-allowance와 동일 결정, 위 파일 상단 주석 참고).
 */
function validateRequiredAmount(
  field: "hourlyWage" | "monthlyWage",
  label: string,
  raw: string | number | undefined,
  errors: ValidationFieldError[],
  max: number,
): number | undefined {
  const num = toOptionalNumber(raw);
  if (num === undefined) {
    errors.push({ field, message: `${label}${particle(label, "을", "를")} 입력해 주세요.` });
    return undefined;
  }
  if (Number.isNaN(num)) {
    errors.push({ field, message: `${label}${particle(label, "은", "는")} 숫자로 입력해 주세요.` });
    return undefined;
  }
  if (num <= 0) {
    errors.push({ field, message: `${label}${particle(label, "은", "는")} 0보다 커야 합니다.` });
    return undefined;
  }
  if (!Number.isInteger(num)) {
    errors.push({ field, message: `${label}${particle(label, "은", "는")} 정수로 입력해 주세요.` });
    return undefined;
  }
  if (num > max) {
    errors.push({
      field,
      message: `${label}${particle(label, "은", "는")} ${max.toLocaleString("ko-KR")}원 이하로 입력해 주세요.`,
    });
    return undefined;
  }
  return num;
}

/**
 * 주 근무시간을 검증한다. 비어 있으면(선택 입력) 오류가 아니라 `DEFAULT_WEEKLY_HOURS`(40)를
 * 반환한다 — SPEC "공통 입력: 주 근무시간(선택, 기본값 40시간)".
 */
function validateWeeklyHours(
  raw: string | number | undefined,
  errors: ValidationFieldError[],
): number | undefined {
  const num = toOptionalNumber(raw);
  if (num === undefined) return DEFAULT_WEEKLY_HOURS;
  if (Number.isNaN(num)) {
    errors.push({ field: "weeklyHours", message: "주 근무시간은 숫자로 입력해 주세요." });
    return undefined;
  }
  if (num <= 0) {
    errors.push({ field: "weeklyHours", message: "주 근무시간은 0시간보다 커야 합니다." });
    return undefined;
  }
  if (num < MIN_WEEKLY_HOURS) {
    errors.push({
      field: "weeklyHours",
      message: `주 근무시간은 ${MIN_WEEKLY_HOURS}시간 이상 입력해 주세요.`,
    });
    return undefined;
  }
  if (num > MAX_WEEKLY_HOURS) {
    errors.push({
      field: "weeklyHours",
      message: `주 근무시간은 ${MAX_WEEKLY_HOURS}시간 이하로 입력해 주세요. (1주는 ${MAX_WEEKLY_HOURS}시간입니다)`,
    });
    return undefined;
  }
  return num;
}

/**
 * 최저임금·시급↔월급 계산기 입력값을 검증한다. FORMULA.md "입력값" 표 + "예외" 절.
 * 성공 시 logic.ts(`calculateMinimumWageComparison`)가 바로 받을 수 있는
 * `MinimumWageCalculatorInput`(discriminated union)을 반환한다.
 *
 * - `mode`: `"HOURLY"`/`"MONTHLY"` 중 하나가 아니면 계산하지 않고 오류(다른 필드는 검사하지
 *   않고 즉시 반환 — 어느 모드인지 모르면 어떤 금액 필드를 검증해야 할지도 알 수 없다).
 * - `hourlyWage`/`monthlyWage`: 해당 모드에서만 필수, 숫자, 정수, `> 0`, 상한 이하.
 * - `weeklyHours`: 선택(빈 값이면 40), 숫자, `>= MIN_WEEKLY_HOURS(1)`, `<= MAX_WEEKLY_HOURS(168)`.
 */
export function validateMinimumWageCalculatorInput(
  raw: RawMinimumWageCalculatorFormInput,
): MinimumWageCalculatorValidationResult {
  if (raw.mode !== "HOURLY" && raw.mode !== "MONTHLY") {
    return {
      success: false,
      errors: [{ field: "mode", message: "계산 방향(시급 또는 월급)을 선택해 주세요." }],
    };
  }

  const errors: ValidationFieldError[] = [];
  const weeklyHours = validateWeeklyHours(raw.weeklyHours, errors);

  if (raw.mode === "HOURLY") {
    const hourlyWage = validateRequiredAmount(
      "hourlyWage",
      "시급",
      raw.hourlyWage,
      errors,
      MAX_HOURLY_WAGE,
    );
    if (errors.length > 0) return { success: false, errors };
    return {
      success: true,
      data: { mode: "HOURLY", hourlyWage: hourlyWage as number, weeklyHours: weeklyHours as number },
    };
  }

  const monthlyWage = validateRequiredAmount(
    "monthlyWage",
    "월급",
    raw.monthlyWage,
    errors,
    MAX_MONTHLY_WAGE,
  );
  if (errors.length > 0) return { success: false, errors };
  return {
    success: true,
    data: { mode: "MONTHLY", monthlyWage: monthlyWage as number, weeklyHours: weeklyHours as number },
  };
}
