/**
 * 국민연금 예상수령액 계산기 — 입력 검증.
 *
 * tasks/national-pension-benefit-estimate/FORMULA.md "입력값" 표 / "예외" 절,
 * tasks/national-pension-benefit-estimate/ARCHITECTURE.md "7. 입력 검증"을 그대로 반영한다.
 * severance-pay/unemployment-benefit과 동일한 순수 TypeScript 검증 함수 패턴을 따른다
 * (zod 미사용 — 이 프로젝트에 zod가 정식 의존성이 아니다).
 *
 * `averageMonthlyIncome`이 기준소득월액 상·하한을 벗어나는 것은 검증 오류가 아니다 —
 * FORMULA.md "예외"에 따라 계산을 막지 않고 logic.ts가 clamp 후 진행하며, `bValueClamped`로
 * 그 사실을 결과에 알린다.
 */

import rates2026 from "@/src/data/rates-2026.json";
import type { NationalPensionBenefitFormInput } from "./types";

/**
 * 성인 가입 가능 연령(SPEC.md birthYear 하한 근거와 동일).
 * ARCHITECTURE.md "7.1" — `totalContributionMonths` 논리적 상한 계산에도 재사용한다.
 */
export const MIN_CONTRIBUTION_START_AGE = 18;

/**
 * 국민연금 가입이 실질적으로 종료된다고 가정하는 안전판 나이(70세). FORMULA.md 수급개시연령
 * 스케줄표 자체가 언급하는 최고 나이(1969년생 이후 연기연금 최고 수급 나이)를 참조했다.
 *
 * **이 값은 법령으로 검증된 상한이 아니라 Architect가 도입한 실용적 안전판(sanity bound)이다**
 * (ARCHITECTURE.md "7.1" — Calculation Auditor가 "확인 필요" 법령 수치로 오인하지 않도록 명시).
 */
export const MAX_CONTRIBUTION_END_AGE = 70;

/**
 * 총 가입기간(이미 납부 + 납부 예정 합산)의 논리적 상한(개월).
 * `(MAX_CONTRIBUTION_END_AGE - MIN_CONTRIBUTION_START_AGE) * 12` = 624개월(52년).
 * ARCHITECTURE.md "7.1" — birthYear와 무관한 상수 구간이다(자세한 근거는 해당 문서 참고).
 */
export const MAX_TOTAL_CONTRIBUTION_MONTHS =
  (MAX_CONTRIBUTION_END_AGE - MIN_CONTRIBUTION_START_AGE) * 12;

/**
 * 출생연도 하한. SPEC.md "권장 범위 1940~(현재연도-18)" — 국민연금 제도 시행(1988) 이전
 * 은퇴 세대까지 넉넉히 포괄한다.
 */
export const MIN_BIRTH_YEAR = 1940;

/**
 * [2026-09-13 Optimizer 추가] "전형적인 풀타임 커리어" 상한(개월). `logic.test.ts` 예제
 * 7(480개월, 40년)이 이미 이 계산기 안에서 "장기가입, 전형적 풀타임 커리어 상한"이라고
 * 명명한 값을 그대로 재사용한다(새 매직넘버를 만들지 않음).
 */
export const TYPICAL_FULL_CAREER_MONTHS = 480;

/**
 * [2026-09-13 Optimizer 추가] 출생연도 기준 "논리적으로 가능한" 총 가입기간 상한(개월).
 *
 * SPEC.md "오류와 예외 처리": "총 가입기간은... 출생연도 기준으로 논리적으로 불가능한
 * 가입기간을 검증한다." — 이 요건이 구현되지 않아 QA가 출생연도 2008년(만 18세) + 가입기간
 * 600개월(50년) 조합이 아무 경고 없이 그대로 계산되는 것을 실측 재현했다
 * (tasks/national-pension-benefit-estimate/QA.md "출생연도 대비 논리적으로 불가능한
 * 가입기간이 검증되지 않음").
 *
 * "국민연금 총 가입기간(가입 예정 포함)" 필드는 이미 낸 기간뿐 아니라 앞으로 낼 예정
 * 기간까지 합산한 값이라는 기존 설계(SPEC.md, ui.tsx helpText)를 그대로 유지해야 한다 —
 * 그래서 이 상한을 "만 18세 이후 지금까지 실제로 경과한 개월수"만으로 제한하지 않는다.
 * 그렇게 하면 아직 젊은 사용자가 "앞으로 계속 납부하면 얼마를 받게 될지" 미리 가늠해 보는
 * 이 계산기의 핵심 사용 시나리오(SPEC.md "핵심 사용자 흐름", `logic.test.ts` 예제 7 주석이
 * 언급하는 "전형적 풀타임 커리어" 40년 계획 등)까지 막아버리게 된다.
 *
 * 따라서 이 상한은 `max(TYPICAL_FULL_CAREER_MONTHS, 만18세 이후 경과 가능 개월수 + 12)`로
 * 정한다 — 즉 출생연도와 무관하게 "전형적인 40년 풀타임 커리어"까지는 항상 허용하고, 그보다
 * 나이가 많아 이미/앞으로 더 오래 가입할 수 있는 사람에게는 그만큼 더 큰 상한을 허용한다.
 * `+12`는 birthYear가 생년월일이 아니라 연도만 저장하는 데서 오는 월 단위 불확실성을
 * 감안한 여유분이다(정확한 생일을 모르므로 가장 관대한 가정에 1년치를 더 얹어 오탐을
 * 줄인다). 이 값을 넘으면(예: 만 18세인데 이미/앞으로 50년(600개월)을 채운다는 조합)
 * "전형적 풀타임 커리어"보다도 훨씬 긴 기간이라 자릿수 오타 등 명백한 입력 실수일
 * 가능성이 매우 높다고 보아 오류로 처리한다.
 *
 * 기존 `MAX_TOTAL_CONTRIBUTION_MONTHS`(624개월, 출생연도와 무관한 상수 상한)는 그대로
 * 유지한다 — 이 함수는 그와 별개로 출생연도와 결합해 판정하는 추가 규칙이다.
 */
export function maxContributionMonthsForBirthYear(
  birthYear: number,
  currentYear: number,
): number {
  const monthsSinceEligible = Math.max(
    0,
    (currentYear - birthYear - MIN_CONTRIBUTION_START_AGE) * 12,
  );
  return Math.max(TYPICAL_FULL_CAREER_MONTHS, monthsSinceEligible + 12);
}

const { earlyPension, deferredPension } = rates2026.nationalPensionBenefit;

/** ui.tsx의 form 상태처럼, 아직 검증 전이라 모든 필드가 문자열/undefined일 수 있는 원시 입력. */
export interface RawNationalPensionBenefitFormInput {
  birthYear?: string | number;
  totalContributionMonths?: string | number;
  averageMonthlyIncome?: string | number;
  /** select 값(문자열로 들어올 수 있음). 미입력/빈 문자열이면 0(그대로)으로 취급한다. */
  earlyOrDeferredMonths?: string | number;
}

export interface ValidationFieldError {
  field:
    | "birthYear"
    | "totalContributionMonths"
    | "averageMonthlyIncome"
    | "earlyOrDeferredMonths";
  message: string;
}

export type NationalPensionBenefitValidationResult =
  | { success: true; data: NationalPensionBenefitFormInput }
  | { success: false; errors: ValidationFieldError[] };

/**
 * 문자열/숫자 입력을 숫자로 정규화한다. 빈 문자열/undefined는 undefined로 취급한다
 * (severance-pay/unemployment-benefit `toOptionalNumber`와 동일한 패턴 — 콤마 제거, trim
 * 처리 포함).
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

/**
 * 국민연금 예상수령액 계산기 입력값을 검증한다.
 *
 * `currentYear`는 이 순수 함수가 `Date.now()`를 직접 읽지 않도록 ui.tsx가 주입한다
 * (docs/ARCHITECTURE.md "날짜 계산" 원칙과 동일한 이유, ARCHITECTURE.md "7.2" 참고).
 * 성공 시 logic.ts(calculateNationalPensionBenefit)가 바로 받을 수 있는
 * NationalPensionBenefitFormInput을 반환한다.
 */
export function validateNationalPensionBenefitInput(
  raw: RawNationalPensionBenefitFormInput,
  currentYear: number,
): NationalPensionBenefitValidationResult {
  const errors: ValidationFieldError[] = [];

  // 출생연도: 필수, 정수, 1940 ~ (currentYear - 18).
  const maxBirthYear = currentYear - MIN_CONTRIBUTION_START_AGE;
  const birthYear = toOptionalNumber(raw.birthYear);
  if (birthYear === undefined) {
    errors.push({ field: "birthYear", message: "출생연도를 입력해 주세요." });
  } else if (Number.isNaN(birthYear)) {
    errors.push({ field: "birthYear", message: "출생연도는 숫자여야 합니다." });
  } else if (!Number.isInteger(birthYear)) {
    errors.push({ field: "birthYear", message: "출생연도는 정수여야 합니다." });
  } else if (birthYear < MIN_BIRTH_YEAR || birthYear > maxBirthYear) {
    errors.push({
      field: "birthYear",
      message: `출생연도는 ${MIN_BIRTH_YEAR}년부터 ${maxBirthYear}년(만 18세 이상) 사이여야 합니다.`,
    });
  }
  // birthYear 자체가 유효(정수, 범위 안)할 때만 아래 totalContributionMonths의
  // "출생연도 기준 논리적 상한" 판정에 사용한다 — birthYear 자체가 오류면 이중으로
  // 혼란스러운 오류를 만들지 않는다.
  const birthYearIsValid =
    birthYear !== undefined &&
    !Number.isNaN(birthYear) &&
    Number.isInteger(birthYear) &&
    birthYear >= MIN_BIRTH_YEAR &&
    birthYear <= maxBirthYear;

  // 총 가입기간: 필수, 정수, 0 ~ MAX_TOTAL_CONTRIBUTION_MONTHS(624개월).
  const totalContributionMonths = toOptionalNumber(raw.totalContributionMonths);
  if (totalContributionMonths === undefined) {
    errors.push({
      field: "totalContributionMonths",
      message: "국민연금 총 가입기간을 입력해 주세요.",
    });
  } else if (Number.isNaN(totalContributionMonths)) {
    errors.push({
      field: "totalContributionMonths",
      message: "국민연금 총 가입기간은 숫자여야 합니다.",
    });
  } else if (!Number.isInteger(totalContributionMonths)) {
    errors.push({
      field: "totalContributionMonths",
      message: "국민연금 총 가입기간(개월)은 정수여야 합니다.",
    });
  } else if (totalContributionMonths < 0) {
    errors.push({
      field: "totalContributionMonths",
      message: "국민연금 총 가입기간은 0 이상이어야 합니다.",
    });
  } else if (totalContributionMonths > MAX_TOTAL_CONTRIBUTION_MONTHS) {
    errors.push({
      field: "totalContributionMonths",
      message: `입력하신 가입기간(${totalContributionMonths}개월)은 만 18세부터 만 70세까지 계속 납부해도 도달하기 어려운 기간입니다. 이미 납부한 기간과 앞으로 납부 예정인 기간을 다시 확인해 주세요.`,
    });
  } else if (
    birthYearIsValid &&
    totalContributionMonths >
      maxContributionMonthsForBirthYear(birthYear as number, currentYear)
  ) {
    // 출생연도 기준 논리적 상한(위 MAX_TOTAL_CONTRIBUTION_MONTHS와 별개 규칙 — SPEC.md
    // "오류와 예외 처리", QA.md "출생연도 대비 논리적으로 불가능한 가입기간" 참고).
    const maxMonths = maxContributionMonthsForBirthYear(
      birthYear as number,
      currentYear,
    );
    errors.push({
      field: "totalContributionMonths",
      message: `입력하신 출생연도(${birthYear}년) 기준으로는 가입기간이 최대 ${maxMonths}개월(약 ${Math.floor(
        maxMonths / 12,
      )}년) 정도까지만 현실적으로 가능합니다. 출생연도와 가입기간을 다시 확인해 주세요.`,
    });
  }

  // 평균 월소득: 필수, 정수, 0 초과. 상·하한 초과는 오류가 아니라 clamp 대상이므로 여기서
  // 상한 초과를 이유로 거부하지 않는다(FORMULA.md "예외").
  const averageMonthlyIncome = toOptionalNumber(raw.averageMonthlyIncome);
  if (averageMonthlyIncome === undefined) {
    errors.push({
      field: "averageMonthlyIncome",
      message: "평균 월소득을 입력해 주세요.",
    });
  } else if (Number.isNaN(averageMonthlyIncome)) {
    errors.push({
      field: "averageMonthlyIncome",
      message: "평균 월소득은 숫자여야 합니다.",
    });
  } else if (!Number.isInteger(averageMonthlyIncome)) {
    errors.push({
      field: "averageMonthlyIncome",
      message: "평균 월소득(원)은 정수여야 합니다.",
    });
  } else if (averageMonthlyIncome <= 0) {
    errors.push({
      field: "averageMonthlyIncome",
      message: "평균 월소득은 0보다 커야 합니다.",
    });
  }

  // 조기/연기 개월수: 선택(기본 0), 정수, -60~60(rates2026에서 상한 조회 — 하드코딩 금지).
  // Golden Test #15(FORMULA.md) — 이 범위를 벗어나면 계산하지 않고 입력 오류로 처리한다.
  const rawEarlyOrDeferred = toOptionalNumber(raw.earlyOrDeferredMonths);
  const earlyOrDeferredMonths = rawEarlyOrDeferred ?? 0;
  const maxEarlyMonths = earlyPension.maxMonths;
  const maxDeferredMonths = deferredPension.maxMonths;
  if (Number.isNaN(earlyOrDeferredMonths)) {
    errors.push({
      field: "earlyOrDeferredMonths",
      message: "조기/연기 선택값을 확인해 주세요.",
    });
  } else if (!Number.isInteger(earlyOrDeferredMonths)) {
    errors.push({
      field: "earlyOrDeferredMonths",
      message: "조기/연기 개월수는 정수여야 합니다.",
    });
  } else if (
    earlyOrDeferredMonths < -maxEarlyMonths ||
    earlyOrDeferredMonths > maxDeferredMonths
  ) {
    errors.push({
      field: "earlyOrDeferredMonths",
      message: `조기/연기는 최대 5년(${maxEarlyMonths}개월)까지만 가능합니다.`,
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      birthYear: birthYear as number,
      totalContributionMonths: totalContributionMonths as number,
      averageMonthlyIncome: averageMonthlyIncome as number,
      earlyOrDeferredMonths,
    },
  };
}
