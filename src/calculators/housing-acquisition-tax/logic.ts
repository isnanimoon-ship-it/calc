/**
 * 주택 취득세 계산기 — 순수 계산 로직.
 *
 * tasks/housing-acquisition-tax/FORMULA.md "계산 순서"를 그대로 구현한다.
 * tasks/housing-acquisition-tax/ARCHITECTURE.md "5."가 지정한 4개 함수(determineStandardRate/
 * determineAppliedRate/calculateTaxAmounts/calculateHousingAcquisitionTax) 그대로다.
 * 세율·계수는 전부 policy.ts에서 읽으며 매직 넘버를 계산 코드에 직접 쓰지 않는다(SPEC.md
 * Must Have).
 *
 * **핵심 불변식(반드시 지킬 것)**:
 * 1. [ARCHITECTURE.md "2."] 6~9억 구간 세율의 소수점 넷째자리 반올림은 **세율을 소수
 *    (fraction)로 나타낸 값 자체**에 적용한다(예: 0.0166667 → 0.0167). 퍼센트로 표기한
 *    숫자(1.66667)를 먼저 반올림한 뒤 100으로 나누지 않는다 — 두 순서는 다른 값을 낸다.
 * 2. [ARCHITECTURE.md "6."] 지방교육세 표준세율 분기(`localEducationTaxRaw`)는 반드시
 *    **절사 전** `acquisitionTaxRaw`를 참조해야 한다(절사 후 `acquisitionTax`가 아님) —
 *    FORMULA.md Golden Test 예제 17이 이 지점을 검증한다.
 * 3. [ARCHITECTURE.md "6."] 세목별(취득세/지방교육세/농어촌특별세) 10원 미만 절사는 각각
 *    독립적으로 1회만 수행하고, 절사된 값을 다른 세목 계산이나 재계산에 재사용하지 않는다.
 */

import { HOUSING_ACQUISITION_TAX_POLICY as POLICY } from "./policy";
import type {
  HouseCountAfterAcquisition,
  HousingAcquisitionTaxFormInput,
  HousingAcquisitionTaxResult,
  PriceTier,
  Rate,
  Won,
} from "./types";

/**
 * FORMULA.md "정밀도/반올림 정책" — 세목별 10원 미만 절사(내림). `policy.ts`의 `rounding`
 * 이 스스로 "확인 필요"(잠정 채택)로 남긴 정책이다(Calculation Auditor 위택스 대조 권고).
 * `src/lib/social-insurance.ts`의 동명 함수를 재사용하지 않는 이유는
 * `tasks/housing-acquisition-tax/ARCHITECTURE.md "6."` 참고(법적 근거가 다르고, 이 계산기만
 * 독립적으로 정책이 바뀔 수 있어야 한다).
 */
function truncateTo10Won(value: number): Won {
  return Math.floor(value / 10) * 10;
}

/**
 * FORMULA.md "1. 주택 유상취득 표준세율" / "계산 순서" 2단계.
 *
 * 가격 구간(6억 이하/6~9억/9억 초과)을 판정하고 표준세율을 산출한다. 6~9억 구간은
 * `(취득가액 ÷ 300,000,000 × 2 − 3) × 1/100`을 계산한 뒤, 그 **소수(fraction) 값 자체**를
 * 소수 넷째자리로 반올림한다(위 "핵심 불변식" 1번, `policy.ts` `standardRate.midTier` 주석
 * 참고).
 *
 * 경계값은 각 구간의 "이하"에 귀속된다 — 정확히 6억원은 low(가목), 정확히 9억원은 mid
 * (나목, 산출값은 다목과 같은 0.03이지만 근거는 나목)로 판정한다(FORMULA.md "예외").
 */
export function determineStandardRate(
  acquisitionPrice: Won,
): { priceTier: PriceTier; standardRate: Rate } {
  const { lowTier, midTier, highTier } = POLICY.standardRate;

  if (acquisitionPrice <= lowTier.maxPrice) {
    return { priceTier: "low", standardRate: lowTier.rate };
  }

  if (acquisitionPrice <= midTier.maxPrice) {
    const rawFraction =
      ((acquisitionPrice / midTier.divisor) * midTier.multiplier - midTier.subtract) /
      midTier.percentDivisor;
    const scale = 10 ** midTier.roundDecimalPlaces;
    const standardRate = Math.round(rawFraction * scale) / scale;
    return { priceTier: "mid", standardRate };
  }

  return { priceTier: "high", standardRate: highTier.rate };
}

/**
 * FORMULA.md "2. 다주택자·조정대상지역 중과세율표" / "계산 순서" 3~4단계.
 *
 * `policy.ts`의 `heavyRate.rows`(조정대상지역 여부 × 취득 후 보유 주택 수 4구간 = 8행)를
 * 그대로 조회해 중과 여부와 적용 세율을 판정한다. 4구간 강제는
 * `types.ts`의 `HouseCountAfterAcquisition` 리터럴 유니온이 담당한다
 * (`tasks/housing-acquisition-tax/ARCHITECTURE.md "1."`).
 *
 * 이 계산기에서 가장 버그에 취약한 지점이라 별도 함수로 분리했다 — Calculation Auditor가
 * 8행 조합 전체를 이 함수 하나로 직접 스윕(sweep)해 검증할 수 있다.
 */
export function determineAppliedRate(
  isAdjustmentTargetArea: boolean,
  houseCount: HouseCountAfterAcquisition,
  standardRate: Rate,
): { isHeavyRateApplied: boolean; appliedRate: Rate } {
  const row = POLICY.heavyRate.rows.find(
    (candidate) =>
      candidate.houseCount === houseCount &&
      candidate.isAdjustmentTargetArea === isAdjustmentTargetArea,
  );

  if (!row) {
    // policy.ts가 4(houseCount) × 2(isAdjustmentTargetArea) = 8개 조합을 전부 명시적으로
    // 나열하므로, 유효한 HouseCountAfterAcquisition 입력이라면 이 분기에 도달할 수 없다
    // (방어적 코드 — 공유 URL 복원 등 타입 시스템 밖 경로를 대비한 안전장치).
    throw new Error(
      `determineAppliedRate: policy.ts에 없는 조합입니다(houseCount=${String(houseCount)}, isAdjustmentTargetArea=${String(isAdjustmentTargetArea)}).`,
    );
  }

  if (row.rate === null) {
    // 중과 대상이 아니면 표준세율을 그대로 적용한다(FORMULA.md "계산 순서" 4단계).
    return { isHeavyRateApplied: false, appliedRate: standardRate };
  }

  return { isHeavyRateApplied: true, appliedRate: row.rate };
}

/**
 * FORMULA.md "계산 순서" 5~9단계 — 세목별(취득세/지방교육세/농어촌특별세) 계산과 10원 미만
 * 절사, 합산을 전담한다.
 *
 * 세 세목의 raw 계산과 절사를 이 함수 하나의 지역 변수 스코프 안에 모아, "절사된 값을 다른
 * 세목 계산에 재사용하지 않는다"는 불변식을 한눈에 확인할 수 있게 한다
 * (`tasks/housing-acquisition-tax/ARCHITECTURE.md "6."`). raw 값은 반환하지 않는다 —
 * `types.ts`의 `HousingAcquisitionTaxResult`에는 절사된 표시값만 노출한다.
 */
export function calculateTaxAmounts(
  acquisitionPrice: Won,
  exclusiveArea: number,
  appliedRate: Rate,
  isHeavyRateApplied: boolean,
): {
  acquisitionTax: Won;
  localEducationTax: Won;
  isRuralSpecialTaxExempt: boolean;
  ruralSpecialTax: Won;
  totalTax: Won;
} {
  // 1. 취득세 — FORMULA.md "계산 순서" 5단계.
  const acquisitionTaxRaw = acquisitionPrice * appliedRate;
  const acquisitionTax = truncateTo10Won(acquisitionTaxRaw);

  // 2. 지방교육세 — FORMULA.md "계산 순서" 6단계.
  //    표준세율 케이스는 반드시 절사 전 acquisitionTaxRaw를 참조한다(핵심 불변식 2번).
  //    중과세율 케이스는 취득가액 × 0.4%(8%/12% 무관 고정, 「지방세법」제151조제1항제1호 나목).
  const localEducationTaxRaw = isHeavyRateApplied
    ? acquisitionPrice * POLICY.localEducationTax.heavyRateFixedFactor
    : acquisitionTaxRaw * POLICY.localEducationTax.standardRateFactor;
  const localEducationTax = truncateTo10Won(localEducationTaxRaw);

  // 3. 농어촌특별세 — FORMULA.md "계산 순서" 7단계. 85㎡ 이하(경계 포함) 비과세.
  const isRuralSpecialTaxExempt =
    exclusiveArea <= POLICY.ruralSpecialTax.exemptAreaThresholdSqm;
  let ruralSpecialTax: Won = 0;
  if (!isRuralSpecialTaxExempt) {
    const ruralRateFactor = !isHeavyRateApplied
      ? POLICY.ruralSpecialTax.standardRateFactor
      : appliedRate === 0.08
        ? POLICY.ruralSpecialTax.heavy8PercentFactor
        : POLICY.ruralSpecialTax.heavy12PercentFactor;
    const ruralSpecialTaxRaw = acquisitionPrice * ruralRateFactor;
    ruralSpecialTax = truncateTo10Won(ruralSpecialTaxRaw);
  }

  // 4. 총 납부액 — FORMULA.md "계산 순서" 9단계. 절사된 세 값의 합(합계 자체는 다시
  //    절사하지 않는다 — 절사된 정수 3개의 합은 항상 이미 10원 단위 정수다).
  const totalTax = acquisitionTax + localEducationTax + ruralSpecialTax;

  return {
    acquisitionTax,
    localEducationTax,
    isRuralSpecialTaxExempt,
    ruralSpecialTax,
    totalTax,
  };
}

/**
 * 오케스트레이터 — 위 세 함수를 FORMULA.md "계산 순서" 그대로 호출해 조립만 한다.
 * `standardRate`는 중과 여부와 무관하게 항상 계산 근거로 노출한다(FORMULA.md "출력값" 표).
 */
export function calculateHousingAcquisitionTax(
  input: HousingAcquisitionTaxFormInput,
): HousingAcquisitionTaxResult {
  const { priceTier, standardRate } = determineStandardRate(input.acquisitionPrice);
  const { isHeavyRateApplied, appliedRate } = determineAppliedRate(
    input.isAdjustmentTargetArea,
    input.houseCountAfterAcquisition,
    standardRate,
  );
  const taxAmounts = calculateTaxAmounts(
    input.acquisitionPrice,
    input.exclusiveArea,
    appliedRate,
    isHeavyRateApplied,
  );

  return {
    priceTier,
    standardRate,
    isHeavyRateApplied,
    appliedRate,
    ...taxAmounts,
  };
}
