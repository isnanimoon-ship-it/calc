/**
 * 대출 이자 계산기 — 입력 검증.
 *
 * tasks/loan-interest-calculator/FORMULA.md "입력값" 표의 허용 범위를 그대로 구현한다.
 * `termMonths`는 UI가 "년 + 개월" 두 필드로 입력받아 합산한 값이므로(ARCHITECTURE.md "5. 대출
 * 기간 입력 UX"), 개별 필드(년/개월) 범위 검증과 별개로 **합산값 자체가 1~480 범위인지도**
 * 최종적으로 검증한다. zod는 이 프로젝트의 정식 의존성이 아니라서(severance-pay/validation.ts
 * 선례) 순수 TypeScript 검증 함수로 작성한다.
 */

import type { LoanInterestCalculatorInput, RepaymentMethod } from "./types";

/** ui.tsx의 form 상태 — 검증 전이라 숫자 필드가 모두 문자열이다. */
export interface RawLoanInterestCalculatorFormInput {
  /** 콤마 포함 가능(예: "10,000,000"). */
  principal: string;
  /** "5", "4.25"처럼 %값 그대로(내부 계산에서만 /100/12로 변환한다). */
  annualRatePercent: string;
  /** 대출 기간 중 "년" 부분. */
  years: string;
  /** 대출 기간 중 "개월" 부분. */
  months: string;
  /** 빈 문자열은 "아직 선택 안 함"을 의미한다. */
  repaymentMethod: RepaymentMethod | "";
}

export type LoanInterestField = keyof RawLoanInterestCalculatorFormInput;

/**
 * "년"·"개월" 두 필드의 합산값(`termMonths`) 자체에 대한 검증 오류는 두 필드 중 하나에
 * 귀속시키지 않고 별도 태그(`"termMonths"`)로 표시한다(UX/UI Critic Low #5 — 원인이 "년"
 * 필드일 수도 있는데 항상 "개월" 필드 아래에만 오류가 표시되던 문제). ui.tsx는 이 태그를
 * "년"·"개월" 입력을 감싸는 그룹 레벨에 표시한다. 합산값 범위 검증 로직(1~480) 자체는
 * 그대로다 — 오류를 어느 필드에 태그하는지만 바뀐다.
 */
export type LoanInterestValidationField = LoanInterestField | "termMonths";

export interface ValidationFieldError {
  field: LoanInterestValidationField;
  message: string;
}

export type ValidationResult =
  | { success: true; data: LoanInterestCalculatorInput }
  | { success: false; errors: ValidationFieldError[] };

/** FORMULA.md "입력값" 표 — 대출 원금 허용 범위. */
export const MIN_PRINCIPAL = 10_000;
export const MAX_PRINCIPAL = 10_000_000_000;

/** FORMULA.md "입력값" 표 — 연이율 허용 범위(%, 소수 둘째 자리까지). */
export const MIN_ANNUAL_RATE_PERCENT = 0;
export const MAX_ANNUAL_RATE_PERCENT = 100;

/** FORMULA.md "입력값" 표 — `termMonths`(합산) 허용 범위. */
export const MIN_TERM_MONTHS = 1;
export const MAX_TERM_MONTHS = 480;

/** ARCHITECTURE.md "5." 필드 설계 — "년" 필드 상한(40년=480개월과 정합). */
export const MAX_YEARS_FIELD = 40;
/** ARCHITECTURE.md "5." 필드 설계 — "개월" 필드 상한(0~11, "1년 6개월"과 "18개월" 표현 모호성 제거). */
export const MAX_MONTHS_FIELD = 11;

const REPAYMENT_METHODS: RepaymentMethod[] = ["equalInstallment", "equalPrincipal", "bullet"];

function parseNonNegativeInteger(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  if (!/^\d+$/.test(trimmed)) return NaN;
  return Number(trimmed);
}

export function validateLoanInterestCalculatorInput(
  raw: RawLoanInterestCalculatorFormInput,
): ValidationResult {
  const errors: ValidationFieldError[] = [];

  // ── principal ─────────────────────────────────────────────────────────────
  const principalDigits = raw.principal.replace(/,/g, "").trim();
  let principal: number | undefined;
  if (!principalDigits) {
    errors.push({ field: "principal", message: "대출 원금을 입력해 주세요." });
  } else if (!/^\d+$/.test(principalDigits)) {
    errors.push({ field: "principal", message: "대출 원금은 숫자만 입력해 주세요." });
  } else {
    const parsed = Number(principalDigits);
    if (parsed < MIN_PRINCIPAL || parsed > MAX_PRINCIPAL) {
      errors.push({
        field: "principal",
        message: `대출 원금은 ${MIN_PRINCIPAL.toLocaleString("ko-KR")}원 이상 ${MAX_PRINCIPAL.toLocaleString("ko-KR")}원 이하로 입력해 주세요.`,
      });
    } else {
      principal = parsed;
    }
  }

  // ── annualRatePercent ─────────────────────────────────────────────────────
  const rateTrimmed = raw.annualRatePercent.trim();
  let annualRatePercent: number | undefined;
  if (!rateTrimmed) {
    errors.push({ field: "annualRatePercent", message: "연이율을 입력해 주세요." });
  } else if (!/^\d+(\.\d{1,2})?$/.test(rateTrimmed)) {
    errors.push({
      field: "annualRatePercent",
      message: "연이율은 소수 둘째 자리까지의 숫자로 입력해 주세요(예: 4.25).",
    });
  } else {
    const parsed = Number(rateTrimmed);
    if (parsed < MIN_ANNUAL_RATE_PERCENT || parsed > MAX_ANNUAL_RATE_PERCENT) {
      errors.push({
        field: "annualRatePercent",
        message: `연이율은 ${MIN_ANNUAL_RATE_PERCENT}% 이상 ${MAX_ANNUAL_RATE_PERCENT}% 이하로 입력해 주세요.`,
      });
    } else {
      annualRatePercent = parsed;
    }
  }

  // ── years / months → termMonths(합산) ────────────────────────────────────
  const years = parseNonNegativeInteger(raw.years === "" ? "0" : raw.years);
  const months = parseNonNegativeInteger(raw.months === "" ? "0" : raw.months);

  let validYears: number | undefined;
  if (years === undefined || Number.isNaN(years)) {
    errors.push({ field: "years", message: "대출 기간(년)은 0 이상의 정수로 입력해 주세요." });
  } else if (years > MAX_YEARS_FIELD) {
    errors.push({
      field: "years",
      message: `대출 기간(년)은 ${MAX_YEARS_FIELD}년 이하로 입력해 주세요.`,
    });
  } else {
    validYears = years;
  }

  let validMonths: number | undefined;
  if (months === undefined || Number.isNaN(months)) {
    errors.push({ field: "months", message: "대출 기간(개월)은 0 이상의 정수로 입력해 주세요." });
  } else if (months > MAX_MONTHS_FIELD) {
    errors.push({
      field: "months",
      message: `대출 기간(개월)은 ${MAX_MONTHS_FIELD}개월 이하로 입력해 주세요(그 이상은 "년"으로 입력해 주세요).`,
    });
  } else {
    validMonths = months;
  }

  let termMonths: number | undefined;
  if (validYears !== undefined && validMonths !== undefined) {
    const total = validYears * 12 + validMonths;
    if (total < MIN_TERM_MONTHS) {
      errors.push({ field: "termMonths", message: "대출 기간은 최소 1개월 이상이어야 합니다." });
    } else if (total > MAX_TERM_MONTHS) {
      errors.push({
        field: "termMonths",
        message: `대출 기간 합계는 ${MAX_TERM_MONTHS}개월(${MAX_TERM_MONTHS / 12}년) 이하로 입력해 주세요.`,
      });
    } else {
      termMonths = total;
    }
  }

  // ── repaymentMethod ───────────────────────────────────────────────────────
  const repaymentMethodValid = REPAYMENT_METHODS.includes(raw.repaymentMethod as RepaymentMethod);
  if (!repaymentMethodValid) {
    errors.push({ field: "repaymentMethod", message: "상환방식을 선택해 주세요." });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      principal: principal as number,
      annualRatePercent: annualRatePercent as number,
      termMonths: termMonths as number,
      repaymentMethod: raw.repaymentMethod as RepaymentMethod,
    },
  };
}
