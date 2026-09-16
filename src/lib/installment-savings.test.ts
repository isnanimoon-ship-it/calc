import { describe, expect, it } from "vitest";
import { calculateInstallmentSimpleInterestTotal } from "./installment-savings";

// Calculation Auditor 재검증(tasks/deposit-savings-interest-calculator/EVALUATION.md
// "## Calculation Auditor (재검증)" "3-B" 절)이 이 함수(military-salary와 공유)에 epsilon
// 보정이 전혀 없어 전체 입력 도메인의 5~10%에서 정확히 1원 작게 계산되는 High 결함을
// 실증했다. 아래 테스트는 그 반례들을 회귀 방지용 Golden Test로 고정한다. 기대값은 Python
// fractions.Fraction 임의정밀도 연산으로 독립 재계산해 확정했다(브루트포스 검증 결과는
// EVALUATION.md "## Optimizer (2차)" 절 참고). 수정 전 구현(순수 Math.floor, epsilon 없음)
// 에서는 아래 사례들이 모두 실패하고(재현 확인됨), 현재 구현(BigInt 유리수 연산)에서는
// 통과해야 한다.
describe("calculateInstallmentSimpleInterestTotal — BigInt 유리수 연산(부동소수점 오차 없음)", () => {
  it("Calculation Auditor 재검증 반례(High) — 부동소수점 오차로 진짜 정수값을 1원 작게 절사하던 문제 해소: 10,000원·연0.03%·7개월", () => {
    // 진짜(유리수) 값은 정확히 7(정수). 수정 전 구현은 raw=6.999999999999999를
    // Math.floor해 6으로 잘못 절사했다.
    expect(calculateInstallmentSimpleInterestTotal(10_000, 0.03, 7)).toBe(7);
  });

  it("military-salary 실사용 반례(이미 배포된 계산기에 실제로 영향을 준 결함) — 550,000원·연4.02%·3개월", () => {
    // 진짜(유리수) 값은 정확히 11,055(정수). 수정 전 구현은 11,054로 잘못 절사했다 —
    // military-salary가 이 함수를 그대로 import해서 쓰므로 이미 배포된 계산기에 실제로
    // 영향을 준 결함이었다(src/calculators/military-salary/logic.test.ts에도 동일 사례를
    // 별도로 고정한다).
    expect(calculateInstallmentSimpleInterestTotal(550_000, 4.02, 3)).toBe(11_055);
  });

  it("기존 military-salary Golden Test 값(우연히 정수 결과라 버그의 영향을 받지 않음) — 550,000원·연5%·18개월 → 391,875원", () => {
    // 550,000 × 0.05 × (18×19/2) / 12 = 391,875 (나머지 없이 정확히 나누어떨어지는 값이라
    // 수정 전/후 구현 모두 동일한 결과를 낸다 — 이 값 자체는 부동소수점 버그의 영향을 받지
    // 않았음을 확인하기 위한 대조군).
    expect(calculateInstallmentSimpleInterestTotal(550_000, 5, 18)).toBe(391_875);
  });

  it("연이율 0%(경계값): 세전 이자는 항상 0원", () => {
    expect(calculateInstallmentSimpleInterestTotal(500_000, 0, 12)).toBe(0);
  });

  it("입력 상한 부근(월 5,000만원·연30%·120개월)에서도 정확한 정수를 반환한다", () => {
    // 550,000×... 류의 반례와 달리 이 조합은 브루트포스 검증(EVALUATION.md 참고)으로
    // 사전에 정확한 정수 결과임이 확인된 경계값 — Number.MAX_SAFE_INTEGER 근처로 가지
    // 않는지도 함께 확인한다.
    const result = calculateInstallmentSimpleInterestTotal(50_000_000, 30, 120);
    expect(Number.isSafeInteger(result)).toBe(true);
    // 50,000,000 × 0.30 × (120×121/2) / 12 = 50,000,000 × 0.30 × 7,260 / 12 = 9,075,000,000
    expect(result).toBe(9_075_000_000);
  });
});
