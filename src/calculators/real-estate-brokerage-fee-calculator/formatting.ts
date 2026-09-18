/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — 표시 포맷팅 및 "계산 근거" 문자열 조립.
 *
 * 계산 로직(logic.ts)과 분리한다(docs/ARCHITECTURE.md "계산 로직 / UI 분리"). 이 파일은
 * 문자열 조립만 담당하고 구간·요율을 새로 판정하지 않는다.
 *
 * **`formatRateAppliedAmountForDisplay`의 정확성 노트(중요, ARCHITECTURE.md "4.2")**: 이
 * 함수는 "계산 근거" 화면에서 "거래금액 × 요율 = 참고 금액"을 보여주기 위해 이미 확정된
 * `baseAmount`·`appliedRate`를 다시 곱한다. 이것은 요율 적용 로직을 "다시 구현"하는 것이
 * 아니다 — 두 값 모두 logic.ts가 실제로 사용한 것과 완전히 같은 값이므로(같은 입력 × 같은
 * 요율은 항상 같은 부동소수점 결과를 낸다), logic.ts 내부의 `rawFee`를 표시 목적으로
 * 재현한다. 이 재계산값은 어떤 반올림·한도 판정에도 재사용되지 않고, 로직/타입에도 저장하지
 * 않는다 — 순수 설명용 숫자다.
 */

import { REAL_ESTATE_BROKERAGE_FEE_POLICY as POLICY } from "./policy";
import type {
  FeeTier,
  LeaseBrokerageFeeInput,
  LeaseBrokerageFeeResult,
  Rate,
  Won,
} from "./types";

const wonFormatter = new Intl.NumberFormat("ko-KR");

export function formatWon(value: Won): string {
  return `${wonFormatter.format(value)}원`;
}

/** 요율을 퍼센트 문자열로 표시한다(예: 0.006 → "0.6%"). 요율 자체는 반올림하지 않는다. */
export function formatPercent(rate: Rate): string {
  return `${(rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}%`;
}

/**
 * 구간(tier)의 하한·상한을 일상어 문구로 표시한다. 최하위 구간(하한 0원)은 "0원 이상"을
 * 생략하고 "OO원 미만"만 보여주고, 최고구간(상한 없음)은 "OO원 이상"만 보여준다
 * (ARCHITECTURE.md "8.1" — "OO원 이상 ~ OO원 미만", 최고구간은 상한 생략).
 */
export function formatTierRangeLabel(tier: FeeTier): string {
  if (tier.lowerBoundInclusive === 0 && tier.upperBoundExclusive !== null) {
    return `${formatWon(tier.upperBoundExclusive)} 미만`;
  }
  if (tier.upperBoundExclusive === null) {
    return `${formatWon(tier.lowerBoundInclusive)} 이상`;
  }
  return `${formatWon(tier.lowerBoundInclusive)} 이상 ~ ${formatWon(tier.upperBoundExclusive)} 미만`;
}

/**
 * 표시 전용 재계산 — `baseAmount × appliedRate`를 다시 계산해 "요율 적용 금액(참고)"을
 * 보여준다(위 파일 상단 주석, ARCHITECTURE.md "4.2"). 이 값은 어떤 판정에도 재사용되지
 * 않으며, 참고용으로 원 단위 반올림해 표시한다.
 */
export function formatRateAppliedAmountForDisplay(baseAmount: Won, appliedRate: Rate): string {
  const referenceAmount = Math.round(baseAmount * appliedRate);
  return formatWon(referenceAmount);
}

/**
 * 한도액 비교 설명 문구. 한도액이 없는 구간(대다수 고가 구간)은 이 줄 자체를 생략한다
 * (`null` 반환, ARCHITECTURE.md "8.1").
 */
export function describeCapComparison(tier: FeeTier, isCapApplied: boolean): string | null {
  if (tier.cap === null) return null;
  return (
    `한도액 ${formatWon(tier.cap)}과 비교 → ` +
    (isCapApplied
      ? "한도액이 더 낮아 한도액이 적용됩니다."
      : "요율 적용 금액이 한도액 이내라 그대로 적용됩니다.")
  );
}

/**
 * 환산보증금 계산 과정을 계산 근거 화면용 문장 배열로 조립한다(ARCHITECTURE.md "8.1" —
 * 기본 산식 표시 → 예외 적용 여부에 따른 안내). 임대차 전용.
 */
export function describeConvertedDepositCalculation(
  input: LeaseBrokerageFeeInput,
  result: LeaseBrokerageFeeResult,
): string[] {
  const { defaultMultiplier, exceptionMultiplier, thresholdExclusiveUpperBound } =
    POLICY.convertedDepositException;
  const raw100 = input.deposit + input.monthlyRent * defaultMultiplier;

  const lines: string[] = [
    `보증금 ${formatWon(input.deposit)} + 월차임 ${formatWon(input.monthlyRent)} × ${defaultMultiplier} = ${formatWon(raw100)}`,
  ];

  if (result.isLowDepositExceptionApplied) {
    lines.push(
      `환산보증금이 ${formatWon(thresholdExclusiveUpperBound)} 미만이라 월차임에 ${defaultMultiplier} 대신 ` +
        `${exceptionMultiplier}을 곱하는 예외가 적용되어, 최종 환산보증금은 ${formatWon(result.convertedDeposit)}입니다.`,
    );
  } else {
    lines.push(`5천만원 미만 예외 조건에 해당하지 않아 이 값이 그대로 최종 환산보증금입니다.`);
  }

  return lines;
}
