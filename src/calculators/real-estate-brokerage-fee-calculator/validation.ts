/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — 입력 검증.
 *
 * tasks/real-estate-brokerage-fee-calculator/FORMULA.md "입력값" 표 / "예외" 절, SPEC.md
 * "오류와 예외 처리"를 그대로 구현한다. zod는 이 프로젝트의 정식 의존성이 아니므로
 * (severance-pay 선례) 순수 TypeScript 검증 함수로 작성한다.
 *
 * **상·하한 근거(FORMULA.md 권고, ARCHITECTURE.md "6." 채택)**: 법적 제약이 아니라 타이핑
 * 실수 방어용 UX 가드다. 거래금액 100만원 미만·1조원 초과는 현실성이 낮아 오타로 간주해
 * 차단한다.
 *
 * **중요(ARCHITECTURE.md "6.2" — 놓치기 쉬운 지점)**: 임대차 모드에서 하한(100만원)은
 * 사용자가 입력한 원시 값 `deposit`에 적용하지만, 상한(1조원)은 `deposit`이 아니라
 * **계산된 `convertedDeposit`**(= `deposit + monthlyRent × 100` 또는 예외 적용 값)에
 * 적용해야 한다 — `deposit` 자체는 상한 이내여도 `monthlyRent`가 커서 `convertedDeposit`이
 * 상한을 넘을 수 있기 때문이다.
 */

import { calculateConvertedDeposit } from "./logic";
import type { RealEstateBrokerageFeeCalculatorInput, TransactionType } from "./types";

/** FORMULA.md "입력값" 표 — 거래금액 하한(원). "비정상적으로 작은 값" 가드. */
export const MIN_BASE_AMOUNT = 1_000_000;
/** 거래금액 상한(원) — ARCHITECTURE.md "7." 최악 조합 검토(1조원까지 Number로 안전). */
export const MAX_BASE_AMOUNT = 1_000_000_000_000;

/**
 * 오류 메시지 표시용 — 자릿수가 많은 상한액에 "(1조원)" 같은 단위 환산 힌트를 병기한다
 * ([Optimizer] UX/UI Critic 선택 Low 1 대응, `average-cost-calculator/validation.ts`의
 * "10,000,000,000원(100억원)" 표기 선례를 그대로 따른다). 검증 로직(비교 조건)에는 영향을
 * 주지 않는 순수 표시 문자열이다.
 */
const MAX_BASE_AMOUNT_LABEL = `${MAX_BASE_AMOUNT.toLocaleString("ko-KR")}원(1조원)`;

/**
 * ui.tsx의 form 상태 — 검증 전이라 금액은 문자열이고, `transactionType`은 아직 선택하지
 * 않은 상태를 표현하기 위해 `null`을 허용한다(SPEC.md Must Have — "거래 유형을 선택하지
 * 않으면 계산하지 않는다", 추정 기본값 금지). 매매·임대차 전용 필드를 하나의 폼 객체에
 * 함께 두고 `transactionType`에 따라 관련 필드만 검증한다(`deposit-savings-interest-
 * calculator`의 `RawDepositSavingsInterestCalculatorFormInput`과 동일 패턴).
 */
export interface RawRealEstateBrokerageFeeFormInput {
  transactionType: TransactionType | null;
  /** 콤마가 포함될 수 있는 금액 문자열(예: "900,000,000"). `transactionType="sale"` 전용. */
  salePrice: string;
  /** 콤마 포함 가능. `transactionType="lease"` 전용. */
  deposit: string;
  /** 콤마 포함 가능. 빈 문자열은 0(전세)으로 처리한다. `transactionType="lease"` 전용. */
  monthlyRent: string;
}

export type RealEstateBrokerageFeeField = keyof RawRealEstateBrokerageFeeFormInput;

export interface ValidationFieldError {
  field: RealEstateBrokerageFeeField;
  message: string;
}

export type ValidationResult =
  | { success: true; data: RealEstateBrokerageFeeCalculatorInput }
  | { success: false; errors: ValidationFieldError[] };

/** 콤마 등 숫자 이외의 문자를 제거하고 숫자로 정규화한다. 빈 값은 undefined, 숫자가 아니면 NaN. */
function toOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.replace(/,/g, "").trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : NaN;
}

export function validateRealEstateBrokerageFeeInput(
  raw: RawRealEstateBrokerageFeeFormInput,
): ValidationResult {
  const errors: ValidationFieldError[] = [];

  // ── transactionType — 미선택 시 계산하지 않음(SPEC Must Have, 추정 기본값 금지) ──────────
  if (raw.transactionType === null) {
    errors.push({
      field: "transactionType",
      message: "거래 유형(매매/임대차)을 선택해 주세요.",
    });
    return { success: false, errors };
  }

  if (raw.transactionType === "sale") {
    const salePrice = toOptionalNumber(raw.salePrice);
    if (salePrice === undefined) {
      errors.push({ field: "salePrice", message: "매매가격을 입력해 주세요." });
    } else if (Number.isNaN(salePrice)) {
      errors.push({ field: "salePrice", message: "매매가격은 숫자로 입력해 주세요." });
    } else if (salePrice <= 0) {
      errors.push({ field: "salePrice", message: "매매가격은 0보다 커야 합니다." });
    } else if (salePrice < MIN_BASE_AMOUNT) {
      errors.push({
        field: "salePrice",
        message: `매매가격이 너무 작습니다. ${MIN_BASE_AMOUNT.toLocaleString("ko-KR")}원 이상인지 확인해 주세요.`,
      });
    } else if (salePrice > MAX_BASE_AMOUNT) {
      errors.push({
        field: "salePrice",
        message: `매매가격이 너무 큽니다. ${MAX_BASE_AMOUNT_LABEL} 이하로 입력해 주세요.`,
      });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      data: { transactionType: "sale", salePrice: salePrice as number },
    };
  }

  // ── 임대차 모드: deposit(필수) + monthlyRent(선택, 기본 0) ──────────────────────────────
  const deposit = toOptionalNumber(raw.deposit);
  if (deposit === undefined) {
    errors.push({ field: "deposit", message: "보증금을 입력해 주세요." });
  } else if (Number.isNaN(deposit)) {
    errors.push({ field: "deposit", message: "보증금은 숫자로 입력해 주세요." });
  } else if (deposit <= 0) {
    errors.push({ field: "deposit", message: "보증금은 0보다 커야 합니다." });
  } else if (deposit < MIN_BASE_AMOUNT) {
    errors.push({
      field: "deposit",
      message: `보증금이 너무 작습니다. ${MIN_BASE_AMOUNT.toLocaleString("ko-KR")}원 이상인지 확인해 주세요.`,
    });
  } else if (deposit > MAX_BASE_AMOUNT) {
    errors.push({
      field: "deposit",
      message: `보증금이 너무 큽니다. ${MAX_BASE_AMOUNT_LABEL} 이하로 입력해 주세요.`,
    });
  }

  // monthlyRent: 빈 값은 0(전세)으로 처리(정상 입력, 오류 아님). 음수만 오류.
  let monthlyRent = 0;
  const monthlyRentTrimmed = raw.monthlyRent.replace(/,/g, "").trim();
  if (monthlyRentTrimmed !== "") {
    const parsedMonthlyRent = Number(monthlyRentTrimmed);
    if (!Number.isFinite(parsedMonthlyRent)) {
      errors.push({ field: "monthlyRent", message: "월세는 숫자로 입력해 주세요." });
    } else if (parsedMonthlyRent < 0) {
      errors.push({ field: "monthlyRent", message: "월세는 음수를 입력할 수 없습니다." });
    } else {
      monthlyRent = parsedMonthlyRent;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // ── 계산된 값 재검증(ARCHITECTURE.md "6.2") ────────────────────────────────────────────
  // deposit 자체는 상한 이내여도 monthlyRent가 커서 convertedDeposit이 상한을 넘을 수 있다.
  // deposit이 유효하다고 확인된 뒤(위에서 errors.length === 0)에만 이 재검증을 수행한다.
  const { convertedDeposit } = calculateConvertedDeposit(deposit as number, monthlyRent);
  if (convertedDeposit > MAX_BASE_AMOUNT) {
    errors.push({
      field: "monthlyRent",
      message:
        `보증금과 월세를 반영한 환산보증금(${convertedDeposit.toLocaleString("ko-KR")}원)이 ` +
        `너무 큽니다. 환산보증금이 ${MAX_BASE_AMOUNT_LABEL} 이하가 되도록 ` +
        "보증금 또는 월세를 조정해 주세요.",
    });
    return { success: false, errors };
  }

  return {
    success: true,
    data: { transactionType: "lease", deposit: deposit as number, monthlyRent },
  };
}
