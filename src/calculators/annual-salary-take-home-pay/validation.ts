/**
 * 연봉 실수령액 계산기 — 입력 검증.
 *
 * tasks/annual-salary-take-home-pay/FORMULA.md "입력값" 표의 허용 범위와 "예외" 절의
 * 조건(비과세 > 월급여, 자녀수 > 가족수-1 등)을 그대로 구현한다. zod는 이 프로젝트의 정식
 * 의존성이 아니라서(severance-pay/validation.ts, housing-subscription-score/validation.ts
 * 선례) 순수 TypeScript 검증 함수로 작성한다.
 */

import type { AnnualSalaryTakeHomePayInput } from "./types";

/** ui.tsx의 form 상태 — 검증 전이라 모든 값이 문자열일 수 있다(천 단위 콤마 포함). */
export interface RawAnnualSalaryTakeHomePayInput {
  annualSalary?: string | number;
  monthlyNonTaxablePay?: string | number;
  dependentFamilyCount?: string | number;
  childrenAge8to20Count?: string | number;
}

export type AnnualSalaryTakeHomePayField = keyof RawAnnualSalaryTakeHomePayInput;

export interface ValidationFieldError {
  field: AnnualSalaryTakeHomePayField;
  message: string;
}

export type AnnualSalaryTakeHomePayValidationResult =
  | { success: true; data: AnnualSalaryTakeHomePayInput }
  | { success: false; errors: ValidationFieldError[] };

/** FORMULA.md "입력값" 표: annualSalary 상한(100억 원). */
export const MAX_ANNUAL_SALARY = 10_000_000_000;

/** FORMULA.md "입력값" 표: dependentFamilyCount 상한(30명). */
export const MAX_DEPENDENT_FAMILY_COUNT = 30;

/** 콤마 등 표시용 서식이 섞인 금액 문자열을 정수로 정규화한다. 빈 값은 undefined, 형식 오류는 NaN. */
function parseAmount(raw: string | number | undefined): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  if (raw == null || raw.trim() === "") return undefined;
  const normalized = raw.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

export function validateAnnualSalaryTakeHomePayInput(
  raw: RawAnnualSalaryTakeHomePayInput,
): AnnualSalaryTakeHomePayValidationResult {
  const errors: ValidationFieldError[] = [];

  // ── annualSalary ──────────────────────────────────────────────────────────────
  const annualSalary = parseAmount(raw.annualSalary);
  if (annualSalary === undefined) {
    errors.push({ field: "annualSalary", message: "세전 연봉을 입력해 주세요." });
  } else if (Number.isNaN(annualSalary) || !Number.isInteger(annualSalary) || annualSalary <= 0) {
    errors.push({ field: "annualSalary", message: "세전 연봉은 0보다 큰 정수(원 단위)로 입력해 주세요." });
  } else if (annualSalary > MAX_ANNUAL_SALARY) {
    errors.push({ field: "annualSalary", message: "세전 연봉은 100억 원 이하로 입력해 주세요." });
  }

  // ── monthlyNonTaxablePay (선택, 기본 0) ──────────────────────────────────────────
  const nonTaxableParsed = parseAmount(raw.monthlyNonTaxablePay);
  const monthlyNonTaxablePay = nonTaxableParsed ?? 0;
  if (nonTaxableParsed !== undefined) {
    if (Number.isNaN(nonTaxableParsed) || !Number.isInteger(nonTaxableParsed) || nonTaxableParsed < 0) {
      errors.push({
        field: "monthlyNonTaxablePay",
        message: "월 비과세 금액은 0 이상의 정수(원 단위)로 입력해 주세요.",
      });
    }
  }

  // ── dependentFamilyCount ─────────────────────────────────────────────────────
  const dependentFamilyCountParsed = parseAmount(raw.dependentFamilyCount);
  if (dependentFamilyCountParsed === undefined) {
    errors.push({ field: "dependentFamilyCount", message: "부양가족 수(본인 포함)를 입력해 주세요." });
  } else if (
    Number.isNaN(dependentFamilyCountParsed) ||
    !Number.isInteger(dependentFamilyCountParsed) ||
    dependentFamilyCountParsed < 1
  ) {
    errors.push({
      field: "dependentFamilyCount",
      message: "부양가족 수(본인 포함)는 1 이상의 정수로 입력해 주세요.",
    });
  } else if (dependentFamilyCountParsed > MAX_DEPENDENT_FAMILY_COUNT) {
    errors.push({
      field: "dependentFamilyCount",
      message: `부양가족 수(본인 포함)는 ${MAX_DEPENDENT_FAMILY_COUNT}명 이하로 입력해 주세요.`,
    });
  }

  // ── childrenAge8to20Count (선택, 기본 0) ─────────────────────────────────────────
  const childrenParsed = parseAmount(raw.childrenAge8to20Count);
  const childrenAge8to20Count = childrenParsed ?? 0;
  if (childrenParsed !== undefined) {
    if (Number.isNaN(childrenParsed) || !Number.isInteger(childrenParsed) || childrenParsed < 0) {
      errors.push({
        field: "childrenAge8to20Count",
        message: "8세~20세 자녀 수는 0 이상의 정수로 입력해 주세요.",
      });
    }
  }

  // ── 필드 간 상호 검증 (개별 필드 형식이 모두 유효할 때만) ─────────────────────────
  const grossPayValid = annualSalary !== undefined && !Number.isNaN(annualSalary) && annualSalary > 0;
  if (
    grossPayValid &&
    nonTaxableParsed !== undefined &&
    !Number.isNaN(nonTaxableParsed) &&
    Number.isInteger(nonTaxableParsed) &&
    nonTaxableParsed >= 0
  ) {
    const monthlyGrossPay = Math.floor((annualSalary as number) / 12);
    if (monthlyNonTaxablePay > monthlyGrossPay) {
      errors.push({
        field: "monthlyNonTaxablePay",
        message: "월 비과세 금액은 세전 월 급여(연봉 ÷ 12)보다 클 수 없습니다.",
      });
    }
  }

  const familyCountValid =
    dependentFamilyCountParsed !== undefined &&
    !Number.isNaN(dependentFamilyCountParsed) &&
    Number.isInteger(dependentFamilyCountParsed) &&
    dependentFamilyCountParsed >= 1 &&
    dependentFamilyCountParsed <= MAX_DEPENDENT_FAMILY_COUNT;
  if (
    familyCountValid &&
    childrenParsed !== undefined &&
    !Number.isNaN(childrenParsed) &&
    Number.isInteger(childrenParsed) &&
    childrenParsed >= 0 &&
    childrenAge8to20Count > (dependentFamilyCountParsed as number) - 1
  ) {
    errors.push({
      field: "childrenAge8to20Count",
      message: "8세~20세 자녀 수는 부양가족 수(본인 포함) - 1명을 초과할 수 없습니다(본인은 자녀가 될 수 없습니다).",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      annualSalary: annualSalary as number,
      monthlyNonTaxablePay,
      dependentFamilyCount: dependentFamilyCountParsed as number,
      childrenAge8to20Count,
    },
  };
}
