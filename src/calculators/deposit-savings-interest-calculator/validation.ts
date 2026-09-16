/**
 * 예금·적금 이자 계산기 — 입력 검증.
 *
 * tasks/deposit-savings-interest-calculator/FORMULA.md "입력값" 표의 허용 범위를 그대로
 * 구현한다. `mode`에 따라 필요한 필드(예금: `principal`+`interestType`, 적금:
 * `monthlyContribution`)만 검증하고 나머지는 무시한다 — 두 모드가 공유하는
 * `annualRatePercent`/`termMonths`는 항상 검증한다.
 *
 * zod는 이 프로젝트의 정식 의존성이 아니므로(severance-pay/validation.ts 선례) 순수
 * TypeScript 검증 함수로 작성한다(loan-interest-calculator/validation.ts와 동일 패턴).
 */

import type {
  DepositInterestType,
  DepositSavingsInterestCalculatorInput,
  DepositSavingsInterestCalculatorMode,
} from "./types";

/** ui.tsx의 form 상태 — 검증 전이라 숫자 필드가 모두 문자열이다. */
export interface RawDepositSavingsInterestCalculatorFormInput {
  mode: DepositSavingsInterestCalculatorMode;
  /** "3", "3.45"처럼 %값 그대로(내부 계산에서만 /100으로 변환한다). */
  annualRatePercent: string;
  /** 개월 수(정수). */
  termMonths: string;
  /** 콤마 포함 가능(예: "10,000,000"). `mode=deposit` 전용. */
  principal: string;
  /** 빈 문자열은 "아직 선택 안 함"을 의미한다. `mode=deposit` 전용. */
  interestType: DepositInterestType | "";
  /** 콤마 포함 가능. `mode=savings` 전용. */
  monthlyContribution: string;
}

export type DepositSavingsInterestField = keyof RawDepositSavingsInterestCalculatorFormInput;

export interface ValidationFieldError {
  field: DepositSavingsInterestField;
  message: string;
}

export type ValidationResult =
  | { success: true; data: DepositSavingsInterestCalculatorInput }
  | { success: false; errors: ValidationFieldError[] };

/** FORMULA.md "입력값" 표 — 예치금액 허용 범위. */
export const MIN_PRINCIPAL = 10_000;
export const MAX_PRINCIPAL = 10_000_000_000;

/** FORMULA.md "입력값" 표 — 월 납입액 허용 범위. */
export const MIN_MONTHLY_CONTRIBUTION = 10_000;
export const MAX_MONTHLY_CONTRIBUTION = 50_000_000;

/** FORMULA.md "입력값" 표 — 연이율 허용 범위(%, 소수 둘째 자리까지). 0%는 유효한 경계값. */
export const MIN_ANNUAL_RATE_PERCENT = 0;
export const MAX_ANNUAL_RATE_PERCENT = 30;

/** FORMULA.md "입력값" 표 — `termMonths` 허용 범위. 1개월은 유효한 경계값. */
export const MIN_TERM_MONTHS = 1;
export const MAX_TERM_MONTHS = 120;

function validateAnnualRatePercent(raw: string, errors: ValidationFieldError[]): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    errors.push({ field: "annualRatePercent", message: "연이율을 입력해 주세요." });
    return undefined;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    errors.push({
      field: "annualRatePercent",
      message: "연이율은 소수 둘째 자리까지의 숫자로 입력해 주세요(예: 3.45).",
    });
    return undefined;
  }
  const parsed = Number(trimmed);
  if (parsed < MIN_ANNUAL_RATE_PERCENT || parsed > MAX_ANNUAL_RATE_PERCENT) {
    errors.push({
      field: "annualRatePercent",
      message: `연이율은 ${MIN_ANNUAL_RATE_PERCENT}% 이상 ${MAX_ANNUAL_RATE_PERCENT}% 이하로 입력해 주세요.`,
    });
    return undefined;
  }
  return parsed;
}

function validateTermMonths(raw: string, errors: ValidationFieldError[]): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    errors.push({ field: "termMonths", message: "기간(개월)을 입력해 주세요." });
    return undefined;
  }
  if (!/^\d+$/.test(trimmed)) {
    errors.push({ field: "termMonths", message: "기간은 개월 수(정수)로 입력해 주세요." });
    return undefined;
  }
  const parsed = Number(trimmed);
  if (parsed < MIN_TERM_MONTHS || parsed > MAX_TERM_MONTHS) {
    errors.push({
      field: "termMonths",
      message: `기간은 ${MIN_TERM_MONTHS}개월 이상 ${MAX_TERM_MONTHS}개월(${MAX_TERM_MONTHS / 12}년) 이하로 입력해 주세요.`,
    });
    return undefined;
  }
  return parsed;
}

function validateAmount(
  raw: string,
  field: DepositSavingsInterestField,
  label: string,
  min: number,
  max: number,
  errors: ValidationFieldError[],
): number | undefined {
  const digits = raw.replace(/,/g, "").trim();
  if (!digits) {
    errors.push({ field, message: `${label}을 입력해 주세요.` });
    return undefined;
  }
  if (!/^\d+$/.test(digits)) {
    errors.push({ field, message: `${label}은 숫자만 입력해 주세요.` });
    return undefined;
  }
  const parsed = Number(digits);
  if (parsed < min || parsed > max) {
    errors.push({
      field,
      message: `${label}은 ${min.toLocaleString("ko-KR")}원 이상 ${max.toLocaleString("ko-KR")}원 이하로 입력해 주세요.`,
    });
    return undefined;
  }
  return parsed;
}

export function validateDepositSavingsInterestCalculatorInput(
  raw: RawDepositSavingsInterestCalculatorFormInput,
): ValidationResult {
  const errors: ValidationFieldError[] = [];

  const annualRatePercent = validateAnnualRatePercent(raw.annualRatePercent, errors);
  const termMonths = validateTermMonths(raw.termMonths, errors);

  if (raw.mode === "deposit") {
    const principal = validateAmount(
      raw.principal,
      "principal",
      "예치 원금",
      MIN_PRINCIPAL,
      MAX_PRINCIPAL,
      errors,
    );

    if (raw.interestType !== "simple" && raw.interestType !== "compound") {
      errors.push({ field: "interestType", message: "이자 계산 방식(단리/월복리)을 선택해 주세요." });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      data: {
        mode: "deposit",
        principal: principal as number,
        annualRatePercent: annualRatePercent as number,
        termMonths: termMonths as number,
        interestType: raw.interestType as DepositInterestType,
      },
    };
  }

  const monthlyContribution = validateAmount(
    raw.monthlyContribution,
    "monthlyContribution",
    "월 납입액",
    MIN_MONTHLY_CONTRIBUTION,
    MAX_MONTHLY_CONTRIBUTION,
    errors,
  );

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      mode: "savings",
      monthlyContribution: monthlyContribution as number,
      annualRatePercent: annualRatePercent as number,
      termMonths: termMonths as number,
    },
  };
}
