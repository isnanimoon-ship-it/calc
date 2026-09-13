/**
 * 평단가(물타기) 계산기 — 표시용 포맷팅 + 방향 라벨 + 계산 근거(breakdown) 조립.
 *
 * ARCHITECTURE.md "10. Builder 인수인계 요약" 7번: `DecimalString`을 천 단위 콤마 표시
 * 문자열로 바꾸고, `direction`별 라벨, `isRoundedToZeroButChanged`일 때의 보조 설명,
 * 계산 근거 문자열을 조립한다 — 숫자를 새로 계산하지 않는다(logic.ts가 이미 확정한
 * `DecimalString` 값을 문자열로 가공만 한다).
 *
 * BigInt 정수부는 `Intl.NumberFormat('ko-KR')`로 그룹 구분한다 — 정수부가 안전 정수
 * 범위(2^53)를 넘어도 `Intl.NumberFormat`은 `BigInt`를 그대로 정확히 포맷한다(예:
 * `new Intl.NumberFormat("ko-KR").format(10000000001000000000000000n)`처럼 검증 예제 10
 * 규모의 값도 손실 없이 표시된다).
 */

import type { AverageCostCalculatorResult, AverageCostDirection, DecimalString } from "./types";

const groupFormatter = new Intl.NumberFormat("ko-KR");

/**
 * `DecimalString`(정수부+선택적 소수부, 부호 "-" 선택)을 천 단위 콤마가 포함된 문자열로
 * 바꾼다. 정수부만 그룹 구분하고 소수부는 원본 자릿수를 그대로 붙인다(반올림하지 않음 —
 * logic.ts가 이미 표시 자릿수로 반올림을 끝낸 값만 이 함수에 들어온다).
 */
export function formatDecimalString(value: DecimalString): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const dotIndex = unsigned.indexOf(".");
  const integerPart = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
  const fractionPart = dotIndex === -1 ? "" : unsigned.slice(dotIndex + 1);
  const groupedInteger = groupFormatter.format(BigInt(integerPart));
  const sign = negative ? "-" : "";
  return fractionPart ? `${sign}${groupedInteger}.${fractionPart}` : `${sign}${groupedInteger}`;
}

/** 금액(원) 표시. */
export function formatWon(value: DecimalString): string {
  return `${formatDecimalString(value)}원`;
}

/**
 * 수량 표시. 이 계산기는 자산 유형(주식/코인) 선택 UI를 두지 않으므로(SPEC.md "핵심 범위
 * 결정") 수량에 "주"/"개" 같은 고정 단위를 강제로 붙이지 않고 그룹 구분된 숫자만 반환한다
 * — 단위는 라벨("보유 수량" 등)과 helpText가 맥락으로 전달한다.
 */
export function formatQty(value: DecimalString): string {
  return formatDecimalString(value);
}

/** 평단가 변동률(%) 표시. 소수 둘째 자리로 반올림(FORMULA.md "단위" 절 권장). */
export function formatPercent(rate: number): string {
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate.toFixed(2)}%`;
}

/** SPEC.md "계산 결과" — 방향별 라벨. */
export const directionLabels: Record<AverageCostDirection, string> = {
  하락: "평단가 하락",
  상승: "평단가 상승",
  변동없음: "변동 없음",
};

/** 방향별 한 줄 설명 — "상승"(불타기)이 오류가 아니라는 점을 명시한다(SPEC.md). */
export const directionDescriptions: Record<AverageCostDirection, string> = {
  하락: "추가 매수 단가가 기존 평단가보다 낮아 평단가가 내려갑니다. 흔히 '물타기'라고 부르는 효과입니다.",
  상승:
    "추가 매수 단가가 기존 평단가보다 높아 평단가가 올라갑니다. 흔히 '불타기'라고 부르며, 오류가 아니라 정상적인 계산 결과입니다.",
  변동없음: "추가 매수 단가가 기존 평단가와 정확히 같아 평단가에 변동이 없습니다.",
};

/**
 * FORMULA.md "변동 없음 표시 모순 방지 규칙" 2번 — `isRoundedToZeroButChanged`가 true일 때
 * (검증 예제 7) 라벨은 그대로 두고 이 보조 설명만 덧붙인다. `direction`을 "변동없음"으로
 * 바꾸지 않는다.
 */
export const ROUNDED_TO_ZERO_BUT_CHANGED_NOTE =
  "표시 자릿수 기준으로는 변동액이 0으로 보일 만큼 미세하지만, 실제로는 위 방향대로 변동했습니다" +
  "(추가 매수 수량이 보유 수량보다 매우 작을 때 발생할 수 있습니다).";

export interface BreakdownLine {
  label: string;
  detail: string;
}

/**
 * 실제 입력값이 대입된 계산 근거(SPEC.md "계산 결과 — 계산 근거" 절, 화면 구성 7번). 숫자를
 * 새로 계산하지 않고 `result`가 이미 확정한 값만 문자열로 조립한다.
 */
export function buildAverageCostBreakdown(result: AverageCostCalculatorResult): BreakdownLine[] {
  const holdingQty = formatQty(result.holdingQty);
  const holdingPrice = formatWon(result.holdingPrice);
  const additionalQty = formatQty(result.additionalQty);
  const additionalPrice = formatWon(result.additionalPrice);

  const lines: BreakdownLine[] = [
    {
      label: "새 평단가",
      detail: `(${holdingQty} × ${holdingPrice} + ${additionalQty} × ${additionalPrice}) ÷ (${holdingQty} + ${additionalQty}) = ${formatWon(result.newAveragePrice)}`,
    },
    {
      label: "총 보유수량",
      detail: `${holdingQty} + ${additionalQty} = ${formatQty(result.totalQty)}`,
    },
    {
      label: "총 투자원금",
      detail: `(${holdingQty} × ${holdingPrice}) + (${additionalQty} × ${additionalPrice}) = ${formatWon(result.totalCost)}`,
    },
    {
      label: "평단가 변동",
      detail: `${formatWon(result.newAveragePrice)} − ${holdingPrice} = ${formatWon(result.priceChangeAmount)} (${formatPercent(result.priceChangeRate)}, ${directionLabels[result.direction]})`,
    },
  ];

  return lines;
}

/** 핵심 결과 카드/공유 텍스트 공통 한 줄 요약. */
export function formatResultSummary(result: AverageCostCalculatorResult): string {
  return `${formatQty(result.totalQty)} 보유, 새 평단가 ${formatWon(result.newAveragePrice)}(${directionLabels[result.direction]})`;
}
