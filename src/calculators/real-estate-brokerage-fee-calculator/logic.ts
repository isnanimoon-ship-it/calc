/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — 순수 계산 로직.
 *
 * tasks/real-estate-brokerage-fee-calculator/FORMULA.md "계산 순서"를 그대로 구현한다.
 * tasks/real-estate-brokerage-fee-calculator/ARCHITECTURE.md "5."가 지정한 함수 구성
 * (findFeeTier/calculateFeeFromTier/calculateConvertedDeposit/calculateSaleBrokerageFee/
 * calculateLeaseBrokerageFee/calculateRealEstateBrokerageFee) 그대로다. 요율·상수는 전부
 * policy.ts에서 읽으며 매직 넘버(0.006, 50_000_000 등)를 계산 코드에 직접 쓰지 않는다
 * (SPEC.md Must Have).
 *
 * **핵심 불변식(반드시 지킬 것, ARCHITECTURE.md 참고)**:
 * 1. [ARCHITECTURE.md "5.1"/"5.2"] 구간 판정(`findFeeTier`)과 요율 적용→한도액 비교→반올림
 *    (`calculateFeeFromTier`)은 매매·임대차가 **완전히 동일한 함수**를 그대로 재사용한다
 *    (복붙 금지).
 * 2. [ARCHITECTURE.md "4."] `rawFee`(요율×거래금액, 반올림 전 완전정밀도)는 `types.ts`에
 *    노출하지 않는다 — `calculateFeeFromTier` 내부 지역 변수로만 존재한다. 한도액 비교는
 *    이 반올림 전 값으로 수행하고, 최종 `maxBrokerageFee` 하나에만 원 단위 사사오입을 1회
 *    적용한다.
 * 3. [ARCHITECTURE.md "2.3"] `appliedRate`는 항상 `calculateFeeFromTier`에 전달된 바로 그
 *    `tier` 인자에서만 파생시킨다(별도 조회 금지 — 드리프트 방지).
 */

import { REAL_ESTATE_BROKERAGE_FEE_POLICY as POLICY } from "./policy";
import type {
  FeeTier,
  LeaseBrokerageFeeInput,
  LeaseBrokerageFeeResult,
  Rate,
  RealEstateBrokerageFeeCalculatorInput,
  RealEstateBrokerageFeeCalculatorResult,
  SaleBrokerageFeeInput,
  SaleBrokerageFeeResult,
  Won,
} from "./types";

/**
 * FORMULA.md "계산 순서" 3단계 — 매매·임대차 요율표 공용 구간 판정.
 *
 * 하한 포함·상한 미포함("미만") 원칙. 최고구간(`upperBoundExclusive === null`)은 상한이
 * 없다(FORMULA.md "1."·"2." 표 공통 구조, ARCHITECTURE.md "5.1").
 */
export function findFeeTier(tiers: readonly FeeTier[], baseAmount: Won): FeeTier {
  const tier = tiers.find(
    (t) =>
      baseAmount >= t.lowerBoundInclusive &&
      (t.upperBoundExclusive === null || baseAmount < t.upperBoundExclusive),
  );
  if (!tier) {
    // 정상 입력(validation.ts를 통과한 baseAmount > 0)이면 도달 불가 — 마지막 구간의
    // upperBoundExclusive가 항상 null이므로 반드시 어느 구간과 매칭된다. 방어적으로만 던진다.
    throw new Error("baseAmount가 어느 요율 구간에도 매칭되지 않았습니다.");
  }
  return tier;
}

/** `calculateFeeFromTier`의 반환 타입 — `types.ts`의 비공개 `BrokerageFeeResultBase` 중
 * 이 함수가 확정하는 세 필드만 뽑았다(ARCHITECTURE.md "5.2"). */
interface FeeFromTierResult {
  appliedRate: Rate;
  isCapApplied: boolean;
  maxBrokerageFee: Won;
}

/**
 * FORMULA.md "계산 순서" 4~6단계 — 요율 적용(완전정밀도) → 한도액 비교(반올림 전 값으로) →
 * 최종 반올림(1회)을 매매·임대차 공용으로 처리한다(ARCHITECTURE.md "5.2", "4.").
 *
 * `rawFee`/`feeBeforeRounding`은 이 함수의 지역 변수로만 존재하고 반환하지 않는다 — raw/display
 * 경계가 이 함수 하나에 집중된다.
 */
export function calculateFeeFromTier(baseAmount: Won, tier: FeeTier): FeeFromTierResult {
  const rawFee = baseAmount * tier.rate;
  const isCapApplied = tier.cap !== null && rawFee > tier.cap;
  const feeBeforeRounding = tier.cap !== null ? Math.min(rawFee, tier.cap) : rawFee;
  const maxBrokerageFee = Math.round(feeBeforeRounding);
  return { appliedRate: tier.rate, isCapApplied, maxBrokerageFee };
}

/**
 * FORMULA.md "계산 순서" 2단계 / "3. 환산보증금 계산" — 기본 산식(×100)과 5천만원 미만
 * 예외(×70)를 판정한다. 임대차 전용이지만 오케스트레이터에 인라인하지 않고 분리한다 —
 * Golden Test가 환산보증금 계산만 독립적으로 검증할 수 있어야 한다(ARCHITECTURE.md "5.3").
 *
 * 판정 기준값은 항상 "기본 산식(×100)으로 계산한 값"(`raw100`)이다. `raw70` 자체가 다시
 * 5천만원 미만인지는 재판정하지 않는다(`raw70 ≤ raw100 < 5천만원`이 항상 성립하므로 무의미).
 * "5천만원 미만"은 `<`이지 `≤`가 아니다 — 정확히 5천만원이면 예외를 적용하지 않는다.
 */
export function calculateConvertedDeposit(
  deposit: Won,
  monthlyRent: Won,
): { convertedDeposit: Won; isLowDepositExceptionApplied: boolean } {
  const { thresholdExclusiveUpperBound, defaultMultiplier, exceptionMultiplier } =
    POLICY.convertedDepositException;

  const raw100 = deposit + monthlyRent * defaultMultiplier;

  if (monthlyRent > 0 && raw100 < thresholdExclusiveUpperBound) {
    return {
      convertedDeposit: deposit + monthlyRent * exceptionMultiplier,
      isLowDepositExceptionApplied: true,
    };
  }

  return { convertedDeposit: raw100, isLowDepositExceptionApplied: false };
}

/** 매매 모드 오케스트레이션 — 구간표 선택(`POLICY.saleTiers`) + 거래금액 산출만 담당. */
export function calculateSaleBrokerageFee(input: SaleBrokerageFeeInput): SaleBrokerageFeeResult {
  const baseAmount = input.salePrice;
  const tier = findFeeTier(POLICY.saleTiers, baseAmount);
  return {
    transactionType: "sale",
    baseAmount,
    appliedTier: tier,
    ...calculateFeeFromTier(baseAmount, tier),
  };
}

/** 임대차 모드 오케스트레이션 — 환산보증금 산출(`calculateConvertedDeposit`) + 구간표 선택
 * (`POLICY.leaseTiers`)을 담당. */
export function calculateLeaseBrokerageFee(
  input: LeaseBrokerageFeeInput,
): LeaseBrokerageFeeResult {
  const { convertedDeposit, isLowDepositExceptionApplied } = calculateConvertedDeposit(
    input.deposit,
    input.monthlyRent,
  );
  const baseAmount = convertedDeposit;
  const tier = findFeeTier(POLICY.leaseTiers, baseAmount);
  return {
    transactionType: "lease",
    baseAmount,
    convertedDeposit,
    isLowDepositExceptionApplied,
    appliedTier: tier,
    ...calculateFeeFromTier(baseAmount, tier),
  };
}

/** 오케스트레이터 — `transactionType`으로 매매/임대차 분기만 담당한다. */
export function calculateRealEstateBrokerageFee(
  input: RealEstateBrokerageFeeCalculatorInput,
): RealEstateBrokerageFeeCalculatorResult {
  return input.transactionType === "sale"
    ? calculateSaleBrokerageFee(input)
    : calculateLeaseBrokerageFee(input);
}
