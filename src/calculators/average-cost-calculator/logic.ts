/**
 * 평단가(물타기) 계산기 — 가중평균 계산(정방향, Must Have).
 *
 * tasks/average-cost-calculator/FORMULA.md "공식 ①"과 "계산 순서(정방향)" 1~9단계를
 * decimal-scale.ts primitive로 그대로 구현한다(ARCHITECTURE.md "3.1"). 이 함수는 입력이
 * 이미 validation.ts를 통과한 유효한 `AverageCostCalculatorInput`이라는 전제로 동작한다
 * (계산 순서 1번 "입력값 검증"은 validation.ts의 책임 — docs/ARCHITECTURE.md "계산 로직 /
 * UI 분리", 이 사이트 다른 계산기와 동일한 관례).
 *
 * 목표 평단가 역산(Should Have)은 이번 라운드에 구현하지 않는다(ARCHITECTURE.md "6.").
 */

import {
  countDecimalPlaces,
  divRoundHalfUp,
  fromScaledBigInt,
  SCALE_DECIMALS,
  SCALE_FACTOR,
  toScaledBigInt,
} from "./decimal-scale";
import type {
  AverageCostCalculatorInput,
  AverageCostCalculatorResult,
  AverageCostDirection,
  AverageCostShareState,
} from "./types";

/** 곱셈(수량×단가) 결과의 스케일 — 8자리 스케일 두 값을 곱하므로 16자리(1e-16원 단위). */
const COST_SCALE_DECIMALS = SCALE_DECIMALS * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 평단가(물타기) 계산기의 핵심 계산 — FORMULA.md "계산 순서(정방향)" 2~9단계.
 *
 * 1단계(입력 검증)는 이 함수의 책임이 아니다 — 호출부(ui.tsx)가 validation.ts를 거친
 * 결과만 이 함수에 넘긴다.
 */
export function calculateAverageCost(input: AverageCostCalculatorInput): AverageCostCalculatorResult {
  const { holdingQty, holdingPrice, additionalQty, additionalPrice } = input;

  // ── 2. 문자열 → BigInt 스케일링(FORMULA.md 계산 순서 2번, parseFloat/Number 미경유) ──────
  const qty1Scaled = toScaledBigInt(holdingQty);
  const price1Scaled = toScaledBigInt(holdingPrice);
  const qty2Scaled = toScaledBigInt(additionalQty);
  const price2Scaled = toScaledBigInt(additionalPrice);

  // ── 3. 비용 계산(BigInt 곱셈, 완전정밀도) — 스케일 16(1e-16원 단위) ─────────────────────
  const cost1Scaled = qty1Scaled * price1Scaled;
  const cost2Scaled = qty2Scaled * price2Scaled;

  // ── 4. 합산(BigInt 덧셈, 완전정밀도) ────────────────────────────────────────────────
  const totalCostScaled = cost1Scaled + cost2Scaled; // 스케일 16
  const totalQtyScaled = qty1Scaled + qty2Scaled; // 스케일 8

  // ── 5. 표시 자릿수 산출 ─────────────────────────────────────────────────────────
  const priceResultDecimals = clamp(
    Math.max(countDecimalPlaces(holdingPrice), countDecimalPlaces(additionalPrice)),
    0,
    SCALE_DECIMALS,
  );
  const qtyResultDecimals = clamp(
    Math.max(countDecimalPlaces(holdingQty), countDecimalPlaces(additionalQty)),
    0,
    SCALE_DECIMALS,
  );

  // ── 6. 새평단가 = totalCostScaled / (totalQtyScaled × 10^8), priceResultDecimals 자리로
  //      사사오입. 총 투자원금은 새평단가에서 역산하지 않고 totalCostScaled에서 독립적으로
  //      반올림한다(FORMULA.md "반올림 시점") ─────────────────────────────────────────
  const newAveragePriceScaled = divRoundHalfUp(
    totalCostScaled * 10n ** BigInt(priceResultDecimals),
    totalQtyScaled * SCALE_FACTOR,
  );
  const newAveragePrice = fromScaledBigInt(newAveragePriceScaled, priceResultDecimals);

  const totalCostRoundedScaled = divRoundHalfUp(
    totalCostScaled,
    10n ** BigInt(COST_SCALE_DECIMALS - priceResultDecimals),
  );
  const totalCost = fromScaledBigInt(totalCostRoundedScaled, priceResultDecimals);

  // ── 7. 총 보유수량 = totalQtyScaled / 10^8, qtyResultDecimals 자리로 자릿수만 맞춤
  //      (BigInt 정수합이라 반올림 손실 없이 정확히 나누어떨어짐) ───────────────────────
  const totalQtyAtResultScale = totalQtyScaled / 10n ** BigInt(SCALE_DECIMALS - qtyResultDecimals);
  const totalQty = fromScaledBigInt(totalQtyAtResultScale, qtyResultDecimals);

  // ── 8. direction — 반올림 이전의 정확한 입력값(스케일된 BigInt)으로만 판정
  //      (FORMULA.md "변동 없음 표시 모순 방지 규칙" 1번) ────────────────────────────────
  let direction: AverageCostDirection;
  if (price2Scaled < price1Scaled) {
    direction = "하락";
  } else if (price2Scaled > price1Scaled) {
    direction = "상승";
  } else {
    direction = "변동없음";
  }

  // ── 9. priceChangeAmount(완전정밀도) = 새평단가(완전정밀도) − holdingPrice를
  //      priceResultDecimals 자리로 반올림. 부호 있는 값이므로 절대값에 divRoundHalfUp
  //      적용 후 부호를 복원한다 ────────────────────────────────────────────────────
  //      새평단가(완전정밀도, 분수) = totalCostScaled / (totalQtyScaled × SCALE_FACTOR)
  //      holdingPrice(완전정밀도, 분수) = price1Scaled / SCALE_FACTOR
  //      차이 = [totalCostScaled − price1Scaled×totalQtyScaled] / (totalQtyScaled×SCALE_FACTOR)
  const priceChangeDenominator = totalQtyScaled * SCALE_FACTOR;
  const priceChangeNumerator = totalCostScaled - price1Scaled * totalQtyScaled;
  const priceChangeIsNegative = priceChangeNumerator < 0n;
  const priceChangeAbsNumerator = priceChangeIsNegative ? -priceChangeNumerator : priceChangeNumerator;

  const priceChangeAmountAbsScaled = divRoundHalfUp(
    priceChangeAbsNumerator * 10n ** BigInt(priceResultDecimals),
    priceChangeDenominator,
  );
  const priceChangeAmountScaled = priceChangeIsNegative ? -priceChangeAmountAbsScaled : priceChangeAmountAbsScaled;
  const priceChangeAmount = fromScaledBigInt(priceChangeAmountScaled, priceResultDecimals);

  // "변동 없음 표시 모순 방지 규칙" 2번: 표시상 0으로 반올림됐지만 실제로는 방향이 있는 경우.
  const isRoundedToZeroButChanged = priceChangeAmountScaled === 0n && direction !== "변동없음";

  // priceChangeRate(%) — 완전정밀도 나눗셈 후 Number로 변환(표시 직전 반올림은 formatting.ts
  // 책임, ARCHITECTURE.md "2.4" 예외 — 이 필드만 number). 큰 BigInt를 Number로 변환할 때
  // 상대오차가 생길 수 있으나, 이 필드는 이미 근사 표시용 비율이라 문제되지 않는다.
  const priceChangeAmountValue =
    (priceChangeIsNegative ? -1 : 1) * (Number(priceChangeAbsNumerator) / Number(priceChangeDenominator));
  const holdingPriceValue = Number(price1Scaled) / Number(SCALE_FACTOR);
  const priceChangeRate = (priceChangeAmountValue / holdingPriceValue) * 100;

  return {
    holdingQty,
    holdingPrice,
    additionalQty,
    additionalPrice,
    newAveragePrice,
    totalQty,
    totalCost,
    priceChangeAmount,
    priceChangeRate,
    direction,
    isRoundedToZeroButChanged,
    priceResultDecimals,
    qtyResultDecimals,
  };
}

/**
 * 공유 URL로부터 복원된 입력으로 결과를 재계산하는 얇은 별칭(ARCHITECTURE.md "3.1").
 * RNG가 없어 입력이 같으면 결과가 항상 같으므로 `calculateAverageCost`와 동작이 완전히
 * 같다 — ui.tsx/useCalculatorShare 호출부가 "공유 복원 전용 진입점"이라는 이름으로 명시적으로
 * 부르고 싶어할 수 있어 별칭만 열어 둔다.
 */
export function restoreAverageCostResult(state: AverageCostShareState): AverageCostCalculatorResult {
  return calculateAverageCost(state);
}
