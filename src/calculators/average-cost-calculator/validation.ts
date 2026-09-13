/**
 * 평단가(물타기) 계산기 — 입력 검증.
 *
 * tasks/average-cost-calculator/ARCHITECTURE.md "4. validation.ts 설계 지침"이 정한 4단계
 * 검증 흐름(형식 → 자릿수 ≤8 → 0 초과 → 상한)을 4개 필드 각각에 적용한다.
 *
 * ARCHITECTURE.md "4."는 이 흐름을 "zod `.refine()` 체이닝"으로 표현했지만, zod는 이
 * 프로젝트의 정식 의존성이 아니다(package.json에 없음, severance-pay/validation.ts·
 * loan-interest-calculator/validation.ts 등 기존 모든 계산기가 동일한 이유로 순수
 * TypeScript 검증 함수를 채택한 선례를 그대로 따른다 — docs/CALCULATOR_RULES.md도
 * "zod 등"이라고 표현해 대안을 허용한다). 검증 **순서와 각 단계의 판정 로직**은
 * ARCHITECTURE.md가 확정한 그대로이고, 구현 수단만 기존 코드베이스 관례를 따른다.
 *
 * 이 계산기는 어디에도 `Number(raw)` 변환이 없다 — 검증도 계산도 문자열/BigInt로만
 * 이뤄진다(ARCHITECTURE.md "4." 마지막 문단, Builder가 반드시 지켜야 할 불변식).
 */

import { countDecimalPlaces, isPlainUnsignedDecimal, SCALE_DECIMALS, toScaledBigInt } from "./decimal-scale";
import type { AverageCostCalculatorInput, AverageCostShareState, DecimalString } from "./types";

/**
 * FORMULA.md "입력값" 표 — 수량(holdingQty/additionalQty) 상한: 10^15(1천조).
 * 근거(FORMULA.md "입력 상한/하한 근거"): 법정 근거가 아니라 UX 방어값. 일부 대형 밈코인의
 * 총발행량이 수백조 개 수준으로 알려져 있어, 이런 극단적 코인 보유량까지 넉넉히 포괄하면서
 * BigInt 고정소수점 연산이 안전하게 처리 가능한 범위다.
 */
export const MAX_QTY = 10n ** 15n;

/**
 * FORMULA.md "입력값" 표 — 단가(holdingPrice/additionalPrice) 상한: 100억원(10^10).
 * 근거: 전 세계 최고가 주식(버크셔 해서웨이 클래스A, 2026-09-10 기준 약 10.3억~10.7억원
 * 환산)의 약 10배 여유. loan-interest-calculator의 원금 상한과 동일 자릿수로 통일.
 */
export const MAX_PRICE = 10n ** 10n;

/** 위 상한을 SCALE_FACTOR(10^8) 단위로 스케일한 값 — toScaledBigInt 결과와 직접 비교한다. */
const MAX_QTY_SCALED = MAX_QTY * 10n ** BigInt(SCALE_DECIMALS);
const MAX_PRICE_SCALED = MAX_PRICE * 10n ** BigInt(SCALE_DECIMALS);

export type AverageCostField = "holdingQty" | "holdingPrice" | "additionalQty" | "additionalPrice";

export interface AverageCostValidationFieldError {
  field: AverageCostField;
  message: string;
}

export type AverageCostValidationResult =
  | { success: true; data: AverageCostCalculatorInput }
  | { success: false; errors: AverageCostValidationFieldError[] };

/** ui.tsx의 form 상태 — 검증 전이라 4개 필드 모두 문자열이다(콤마 제거 후 원본 문자열). */
export interface RawAverageCostFormInput {
  holdingQty: string;
  holdingPrice: string;
  additionalQty: string;
  additionalPrice: string;
}

/**
 * 필드별 오류 메시지. 한글 조사(을/를, 은/는)가 라벨마다 다르므로(예: "수량은"/"단가는")
 * 공용 템플릿에 라벨 문자열만 끼워 넣지 않고 필드마다 문장을 직접 작성한다(다른 계산기들의
 * 관례와 동일 — loan-interest-calculator/validation.ts도 필드별로 메시지를 직접 쓴다).
 */
const REQUIRED_MESSAGES: Record<AverageCostField, string> = {
  holdingQty: "보유 수량을 입력해 주세요.",
  holdingPrice: "보유 평단가를 입력해 주세요.",
  additionalQty: "추가 매수 수량을 입력해 주세요.",
  additionalPrice: "추가 매수 단가를 입력해 주세요.",
};

const FORMAT_MESSAGES: Record<AverageCostField, string> = {
  holdingQty: "보유 수량에는 0보다 큰 숫자만 입력할 수 있습니다.",
  holdingPrice: "보유 평단가에는 0보다 큰 숫자만 입력할 수 있습니다.",
  additionalQty: "추가 매수 수량에는 0보다 큰 숫자만 입력할 수 있습니다.",
  additionalPrice: "추가 매수 단가에는 0보다 큰 숫자만 입력할 수 있습니다.",
};

const DECIMAL_PLACES_MESSAGES: Record<AverageCostField, string> = {
  holdingQty: `보유 수량은 소수점 ${SCALE_DECIMALS}자리까지 입력할 수 있습니다.`,
  holdingPrice: `보유 평단가는 소수점 ${SCALE_DECIMALS}자리까지 입력할 수 있습니다.`,
  additionalQty: `추가 매수 수량은 소수점 ${SCALE_DECIMALS}자리까지 입력할 수 있습니다.`,
  additionalPrice: `추가 매수 단가는 소수점 ${SCALE_DECIMALS}자리까지 입력할 수 있습니다.`,
};

const ZERO_OR_LESS_MESSAGES: Record<AverageCostField, string> = {
  holdingQty: "보유 수량은 0보다 큰 값을 입력해 주세요.",
  holdingPrice: "보유 평단가는 0보다 큰 값을 입력해 주세요.",
  additionalQty: "추가 매수 수량은 0보다 큰 값을 입력해 주세요.",
  additionalPrice: "추가 매수 단가는 0보다 큰 값을 입력해 주세요.",
};

const UPPER_BOUND_MESSAGES: Record<AverageCostField, string> = {
  holdingQty: "보유 수량은 1,000,000,000,000,000(1천조) 이하로 입력해 주세요.",
  holdingPrice: "보유 평단가는 10,000,000,000원(100억원) 이하로 입력해 주세요.",
  additionalQty: "추가 매수 수량은 1,000,000,000,000,000(1천조) 이하로 입력해 주세요.",
  additionalPrice: "추가 매수 단가는 10,000,000,000원(100억원) 이하로 입력해 주세요.",
};

/**
 * 필드 하나를 ARCHITECTURE.md "4."의 4단계로 검증한다.
 * 1. `isPlainUnsignedDecimal` — 형식(부호 없는 순수 십진수)
 * 2. `countDecimalPlaces <= 8` — 소수 자릿수 상한(FORMULA.md "예외" — 자동 반올림·절사 금지)
 * 3. `toScaledBigInt(...) > 0n` — 0 초과
 * 4. `toScaledBigInt(...) <= upperBoundScaled` — 입력 상한
 */
function validateField(
  field: AverageCostField,
  raw: string,
  upperBoundScaled: bigint,
): { value: DecimalString } | { error: AverageCostValidationFieldError } {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { error: { field, message: REQUIRED_MESSAGES[field] } };
  }
  if (!isPlainUnsignedDecimal(trimmed)) {
    return { error: { field, message: FORMAT_MESSAGES[field] } };
  }
  if (countDecimalPlaces(trimmed) > SCALE_DECIMALS) {
    return { error: { field, message: DECIMAL_PLACES_MESSAGES[field] } };
  }

  const scaled = toScaledBigInt(trimmed);
  if (scaled <= 0n) {
    return { error: { field, message: ZERO_OR_LESS_MESSAGES[field] } };
  }
  if (scaled > upperBoundScaled) {
    return { error: { field, message: UPPER_BOUND_MESSAGES[field] } };
  }

  return { value: trimmed };
}

export function validateAverageCostInput(raw: RawAverageCostFormInput): AverageCostValidationResult {
  const errors: AverageCostValidationFieldError[] = [];

  const holdingQtyResult = validateField("holdingQty", raw.holdingQty, MAX_QTY_SCALED);
  const holdingPriceResult = validateField("holdingPrice", raw.holdingPrice, MAX_PRICE_SCALED);
  const additionalQtyResult = validateField("additionalQty", raw.additionalQty, MAX_QTY_SCALED);
  const additionalPriceResult = validateField("additionalPrice", raw.additionalPrice, MAX_PRICE_SCALED);

  for (const result of [holdingQtyResult, holdingPriceResult, additionalQtyResult, additionalPriceResult]) {
    if ("error" in result) errors.push(result.error);
  }

  if (
    errors.length > 0 ||
    !("value" in holdingQtyResult) ||
    !("value" in holdingPriceResult) ||
    !("value" in additionalQtyResult) ||
    !("value" in additionalPriceResult)
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      holdingQty: holdingQtyResult.value,
      holdingPrice: holdingPriceResult.value,
      additionalQty: additionalQtyResult.value,
      additionalPrice: additionalPriceResult.value,
    },
  };
}

// ── 공유 상태(AverageCostShareState) 파싱 ───────────────────────────────────────

/**
 * `decodeShareState`가 반환한 `unknown` 페이로드를 `AverageCostShareState`로 파싱한다.
 * `AverageCostShareState = AverageCostCalculatorInput`(types.ts)이므로 4개 필드 모두
 * `DecimalString`(문자열)이어야 하고, 각 값이 여전히 유효 범위 안에 있는지 재검증한다
 * (손상되거나 조작된 공유 링크 방어 — bill-split-calculator의 `parseBillSplitShareState`와
 * 동일한 층위).
 */
export function parseAverageCostShareState(data: unknown): AverageCostShareState | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;

  const fields: AverageCostField[] = ["holdingQty", "holdingPrice", "additionalQty", "additionalPrice"];
  for (const field of fields) {
    if (typeof record[field] !== "string") return null;
  }

  const validation = validateAverageCostInput({
    holdingQty: record.holdingQty as string,
    holdingPrice: record.holdingPrice as string,
    additionalQty: record.additionalQty as string,
    additionalPrice: record.additionalPrice as string,
  });
  if (!validation.success) return null;
  return validation.data;
}
