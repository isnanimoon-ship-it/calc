/**
 * 평단가(물타기) 계산기 — BigInt 8자리 고정소수점 스케일링 순수 산술 primitive.
 *
 * tasks/average-cost-calculator/ARCHITECTURE.md "2.5 확정: decimal-scale.ts 유틸 함수
 * 시그니처"에서 확정한 시그니처를 그대로 구현한다. 이 파일은 "평단가"라는 도메인 지식이
 * 전혀 없는 순수 산술 모듈이다(어떤 필드가 가격인지 수량인지 모른다) — 상한값(수량 10^15,
 * 단가 100억원) 같은 도메인 지식은 여기 두지 않고 validation.ts가 갖는다(ARCHITECTURE.md
 * "2.5 설계 원칙").
 *
 * 핵심 불변식(FORMULA.md "정밀도/반올림 정책"): `parseFloat`/`Number()`를 전혀 거치지 않는다.
 * 문자열을 정수부/소수부로 직접 분리해 BigInt로 변환하므로, 이 파일 어디에도 부동소수점이
 * 개입할 여지가 없다.
 */

/** 이 계산기가 내부적으로 쓰는 고정 소수 자릿수(FORMULA.md "정밀도/반올림 정책" — 코인 8자리 대응). */
export const SCALE_DECIMALS = 8;

/** `10 ** SCALE_DECIMALS`(100_000_000n) — 값에 이 팩터를 곱하면 8자리 고정소수점 정수가 된다. */
export const SCALE_FACTOR = 10n ** BigInt(SCALE_DECIMALS);

/**
 * 부호 없는 순수 십진수 형식인지만 검사한다(자릿수 상한은 검사하지 않음 — 그건
 * countDecimalPlaces로 별도 검사). "0", "0.5", "10000" 등만 허용하고 지수 표기(1e10),
 * 부호(+/-), 공백, 다중 소수점, 선행 소수점(".5"), 빈 문자열은 모두 false.
 */
export function isPlainUnsignedDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value);
}

/** 소수점 이하 자릿수. 정수(소수점 없음)는 0을 반환한다. 형식이 올바른 값에만 호출한다. */
export function countDecimalPlaces(value: string): number {
  const dotIndex = value.indexOf(".");
  return dotIndex === -1 ? 0 : value.length - dotIndex - 1;
}

/**
 * `isPlainUnsignedDecimal(value)`가 true이고 `countDecimalPlaces(value) <= scale`인 값만
 * 호출한다는 전제로, `value × 10^scale`을 나타내는 BigInt로 변환한다. **parseFloat/Number를
 * 전혀 거치지 않고** 정수부/소수부 문자열을 직접 분리 → 소수부를 scale 자리로 우측
 * 0-패딩 → 문자열을 이어붙여 BigInt로 변환한다(FORMULA.md "문자열 기반 스케일링" 그대로).
 * 전제가 깨지면 예외를 던진다 — 호출부(validation.ts)가 반드시 먼저
 * isPlainUnsignedDecimal/countDecimalPlaces로 형식을 확인한 뒤에만 호출해야 한다.
 */
export function toScaledBigInt(value: string, scale: number = SCALE_DECIMALS): bigint {
  const dotIndex = value.indexOf(".");
  const integerPart = dotIndex === -1 ? value : value.slice(0, dotIndex);
  const fractionPart = dotIndex === -1 ? "" : value.slice(dotIndex + 1);

  if (!isPlainUnsignedDecimal(value)) {
    throw new Error(`toScaledBigInt: "${value}"는 유효한 부호 없는 십진수 형식이 아닙니다.`);
  }
  if (fractionPart.length > scale) {
    throw new Error(
      `toScaledBigInt: "${value}"의 소수 자릿수(${fractionPart.length})가 허용 자릿수(${scale})를 초과합니다.`,
    );
  }

  const paddedFraction = fractionPart.padEnd(scale, "0");
  return BigInt(integerPart + paddedFraction);
}

/**
 * 나머지 기반 사사오입 나눗셈(FORMULA.md 알고리즘 그대로). `numerator >= 0n`,
 * `denominator > 0n` 전제 — 이 계산기는 수량·단가가 항상 0 초과라는 입력 검증을 거치므로
 * 이 전제가 항상 성립하는 지점에서만 쓴다. **부호 있는 값(예: priceChangeAmount)에는
 * 절대값에 적용한 뒤 호출부가 부호를 별도로 복원한다** — 이 함수 자체가 부호를 처리하지
 * 않는다.
 */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  // 나머지×2 ≥ 분모이면 올림 (사사오입, 분모가 항상 양수라는 전제).
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

/**
 * `value × 10^decimals`를 나타내는 (음수 가능) BigInt를 십진 문자열로 되돌린다. **반올림하지
 * 않는다** — 순수 자릿수 삽입 함수다. 호출 전에 이미 `divRoundHalfUp` 등으로 반올림이 끝나
 * 있어야 한다(중복 반올림 방지). `decimals === 0`이면 정수 문자열을 그대로 반환한다.
 */
export function fromScaledBigInt(scaledValue: bigint, decimals: number): string {
  const negative = scaledValue < 0n;
  const abs = negative ? -scaledValue : scaledValue;
  const sign = negative ? "-" : "";

  if (decimals === 0) {
    return `${sign}${abs.toString()}`;
  }

  const digits = abs.toString().padStart(decimals + 1, "0");
  const integerPart = digits.slice(0, digits.length - decimals);
  const fractionPart = digits.slice(digits.length - decimals);
  return `${sign}${integerPart}.${fractionPart}`;
}

/**
 * 두 유효 십진 문자열을 정확히 비교한다(문자열 사전식 비교 금지 — 예: "9" > "10"이 사전식
 * 비교로는 참이 되는 함정을 피한다). 내부적으로 `toScaledBigInt`로 변환한 뒤 BigInt로
 * 비교한다. logic.test.ts의 불변식 검증(예: "새평단가가 min/max 사이")과 direction 판정
 * 양쪽에서 재사용한다.
 */
export function compareDecimalStrings(a: string, b: string, scale: number = SCALE_DECIMALS): -1 | 0 | 1 {
  const scaledA = toScaledBigInt(a, scale);
  const scaledB = toScaledBigInt(b, scale);
  if (scaledA < scaledB) return -1;
  if (scaledA > scaledB) return 1;
  return 0;
}
