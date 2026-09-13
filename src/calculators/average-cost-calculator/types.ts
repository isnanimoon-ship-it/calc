/**
 * 평단가(물타기) 계산기 타입 — tasks/average-cost-calculator/FORMULA.md 기준.
 *
 * Architect 스캐폴딩이다 — 공식 자체는 정의하지 않는다(Formula Analyst 영역, 가중평균 공식·
 * 반올림 정책을 바꾸지 않았다). 여기서는 입력/출력 "계약"(모양)만 고정한다. 상세 근거는
 * tasks/average-cost-calculator/ARCHITECTURE.md를 참고한다.
 *
 * ## 이 타입이 다른 계산기와 다른 지점 (반드시 읽을 것)
 * 이 계산기는 이 사이트 최초로 **수량 자체가 소수**이고, BigInt 8자리 고정소수점 스케일링을
 * 채택한 계산기다(ARCHITECTURE.md "2. 숫자 정밀도 전략"). 이 때문에 다른 모든 계산기가 따르는
 * `Won = number` 관례를 이 계산기의 "정확한 계산값" 4종(`newAveragePrice`/`totalQty`/
 * `totalCost`/`priceChangeAmount`)에는 적용하지 않는다 — 대신 **`DecimalString`**(정확한
 * 십진 문자열)을 쓴다.
 *
 * 이유: FORMULA.md가 허용하는 입력 상한(단가 최대 100억원 = 10^10, 소수 8자리까지)만 조합해도
 * 이미 `number`의 안전 정수 범위(2^53 ≈ 9.007×10^15, 유효자리 약 15~17자리)를 넘는 유효자리
 * (예: "9999999999.99999999"는 18자리)가 필요해진다. 수량 상한(10^15)까지 곱해지는
 * `totalCost`는 최악의 경우 약 10^26까지 커질 수 있어 훨씬 더 심각하다(ARCHITECTURE.md "2.3"
 * 참고). `number`로 표현하는 순간 그 경계에서 정밀도가 소실되므로, 내부 연산을 BigInt로 아무리
 * 정확히 해도 타입 경계에서 오차가 재도입된다 — 이를 막기 위해 경계 타입 자체를 정확한 문자열로
 * 정했다. 부수 이점: `DecimalString`은 `BigInt`와 달리 `JSON.stringify`로 직렬화 가능해
 * `src/lib/share.ts`의 공유 URL 인코딩과 그대로 호환된다(`BigInt`를 결과 타입에 그대로
 * 노출했다면 공유 기능이 애초에 깨졌을 것이다).
 *
 * `priceChangeRate`(퍼센트)는 예외다 — 표시 직전 반올림되는 근사 비율이라 이 정밀도 문제와
 * 무관하며(ARCHITECTURE.md "2.4"), 다른 계산기의 비율 필드(`annualRatePercent` 등)와 동일하게
 * 그냥 `number`를 쓴다.
 */

/**
 * 검증을 통과한 0 초과 십진수 문자열. 부호 없음, 지수 표기 없음, 소수점 이하 최대 8자리,
 * 천 단위 콤마 등 표시용 구두점은 이미 제거된 상태(예: "0.5", "10000", "0.00012345").
 * `decimal-scale.ts`(Builder 구현, ARCHITECTURE.md "3. decimal-scale.ts 유틸 시그니처"에서
 * 시그니처를 확정함)의 `toScaledBigInt`가 이 형식만 입력으로 받는다는 전제로 동작한다.
 * 타입 시스템이 형식 자체를 강제하지는 않는다(런타임 검증은 validation.ts 책임) — 브랜드
 * 타입을 쓰지 않은 이유는 이 사이트의 다른 계산기들도 입력 검증을 zod refine으로만 하고
 * 브랜드 타입을 쓰지 않는 관례를 따른 것뿐, 별다른 의미는 없다.
 */
export type DecimalString = string;

export type AverageCostDirection = "하락" | "상승" | "변동없음";

export interface AverageCostCalculatorInput {
  /** 보유 수량. FORMULA.md 허용 범위: 0 초과, 소수 8자리까지, 상한 10^15(1,000,000,000,000,000). */
  holdingQty: DecimalString;
  /** 보유 평단가(원). 0 초과, 소수 8자리까지, 상한 10,000,000,000(100억원). */
  holdingPrice: DecimalString;
  /** 추가 매수 수량. 0 초과, 소수 8자리까지, 상한 10^15. */
  additionalQty: DecimalString;
  /** 추가 매수 단가(원). 0 초과, 소수 8자리까지, 상한 100억원. */
  additionalPrice: DecimalString;
}

/**
 * 공유 URL(`ShareActions`) 상태 페이로드. 이 계산기는 RNG가 없고 결과가 4개 입력값만으로
 * 항상 결정적으로 재계산되므로(`bill-split-calculator`의 "equal" 모드 — "결과가 입력만으로
 * 결정적으로 재계산되므로 결과 스냅샷을 넣지 않는다"와 동일한 성격), 입력 타입을 그대로
 * 공유 상태로 재사용한다. 별도 타입을 만들지 않는다(SPEC.md "공유 상태에는 보유 수량·보유
 * 평단가·추가 매수 수량·추가 매수 단가만 저장한다"와 정확히 일치).
 */
export type AverageCostShareState = AverageCostCalculatorInput;

export interface AverageCostCalculatorResult {
  // 계산 근거(수식 breakdown) 대조용 — 입력값을 재포맷/재파싱 없이 그대로 echo한다.
  holdingQty: DecimalString;
  holdingPrice: DecimalString;
  additionalQty: DecimalString;
  additionalPrice: DecimalString;

  /** 매수 후 새 평단가(원) — 핵심 결과. `priceResultDecimals` 자리로 반올림된 정확한 십진 문자열. */
  newAveragePrice: DecimalString;
  /** 총 보유수량 = holdingQty + additionalQty. `qtyResultDecimals` 자리(반올림 아님 — BigInt 정수합이라 손실 없는 자릿수 맞춤일 뿐). */
  totalQty: DecimalString;
  /** 총 투자원금(원). `priceResultDecimals` 자리로 **독립적으로** 반올림한다(`newAveragePrice`에서 역산하지 않는다 — FORMULA.md "반올림 시점"). */
  totalCost: DecimalString;
  /**
   * 평단가 변동액(원) = 새평단가(완전정밀도, 반올림 전) − holdingPrice, `priceResultDecimals`
   * 자리로 반올림. 부호 있음("-" 접두 = 하락, 접두 없음 = 상승/0, FORMULA.md "출력값" 표).
   */
  priceChangeAmount: DecimalString;
  /**
   * 평단가 변동률(%) = priceChangeAmount ÷ holdingPrice × 100. 완전정밀도 나눗셈 후 표시
   * 직전 반올림(권장 소수 둘째 자리) — 위 클래스 주석대로 BigInt 문자열 경계 대상이 아니다.
   */
  priceChangeRate: number;
  /**
   * "하락"/"상승"/"변동없음" — **반올림 이전의 정확한 입력값**(스케일된 BigInt로 정확히
   * 비교)만으로 판정한다(FORMULA.md "변동 없음 표시 모순 방지 규칙" 1번). 반올림된
   * `newAveragePrice`와 `holdingPrice`를 비교해서 판정하지 않는다 — "상승"(불타기)은
   * 오류가 아니라 정상 결과이므로, UI가 이 값을 에러 상태로 취급해서는 안 된다(SPEC.md).
   */
  direction: AverageCostDirection;
  /**
   * `priceChangeAmount`(표시)가 반올림으로 인해 "0"이 되었는데 실제 `direction`은
   * "변동없음"이 아닌 경우 true(FORMULA.md "모순 방지 규칙" 2번 — 검증 예제 7). true여도
   * `direction` 라벨 자체는 절대 "변동없음"으로 바뀌지 않는다 — formatting.ts/ui.tsx는 이
   * 값을 보고 "표시 자릿수 기준으로는 변동액이 0으로 보일 만큼 미세합니다" 같은 보조 설명만
   * 덧붙인다. 문장 조립은 formatting.ts 책임이고 이 필드는 그 판단에 필요한 계산된 값이다
   * (loan-interest-calculator/housing-subscription-score가 확립한 "로직 값만, 문장 조립은
   * formatting.ts" 경계).
   */
  isRoundedToZeroButChanged: boolean;
  /** `clamp(max(decimalPlaces(holdingPrice), decimalPlaces(additionalPrice)), 0, 8)` — newAveragePrice/totalCost/priceChangeAmount 공통 자릿수. */
  priceResultDecimals: number;
  /** `clamp(max(decimalPlaces(holdingQty), decimalPlaces(additionalQty)), 0, 8)` — totalQty 자릿수. */
  qtyResultDecimals: number;
}
