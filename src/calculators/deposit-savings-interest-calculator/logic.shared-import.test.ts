/**
 * 예금·적금 이자 계산기 — 적금 세전 이자 총합 산식이 `src/lib/installment-savings.ts`의
 * `calculateInstallmentSimpleInterestTotal`을 실제로 import해서 쓰는지(로컬 재구현이
 * 아닌지) 검증한다.
 *
 * Builder 작업 지시: "적금 총 세전이자 계산은 반드시 src/lib/installment-savings.ts의
 * calculateInstallmentSimpleInterestTotal을 import해서 써라 — 로컬로 다시 구현하지 마라."
 *
 * 단순히 두 함수의 계산 결과가 같은지 비교하는 것만으로는 "우연히 같은 산식을 로컬에 다시
 * 구현했을 가능성"을 배제하지 못한다. 대신 `src/lib/installment-savings` 모듈 자체를
 * 모킹해 의도적으로 다른 값(999)을 반환하게 만든 뒤, `logic.ts`의 `calculateSavings`가 그
 * 모킹된 값을 그대로 반영하는지 확인한다 — 실제로 이 모듈을 import해서 호출하고 있어야만
 * 모킹의 영향을 받는다(로컬 재구현이었다면 이 테스트가 실패한다).
 * (minimum-wage-calculator/logic.shared-import.test.ts와 동일한 패턴.)
 *
 * `vi.mock`은 파일 상단에서 호이스팅되어 이 파일 전체에 적용되므로, 다른 Golden
 * Test(logic.test.ts)와 분리된 별도 파일로 둔다.
 */

import { describe, expect, it, vi } from "vitest";
import type { SavingsInput } from "./types";

vi.mock("@/src/lib/installment-savings", () => ({
  calculateInstallmentSimpleInterestTotal: vi.fn(() => 999),
}));

describe("calculateSavings — src/lib/installment-savings.ts의 calculateInstallmentSimpleInterestTotal을 실제로 import해서 호출한다", () => {
  it("모듈을 모킹하면 그 반환값(999)이 preTaxInterest에 그대로 반영된다", async () => {
    const { calculateSavings } = await import("./logic");
    const input: SavingsInput = {
      mode: "savings",
      monthlyContribution: 500_000,
      annualRatePercent: 3.5,
      termMonths: 12,
    };
    const result = calculateSavings(input);
    expect(result.preTaxInterest).toBe(999);
    // 세금 계산·만기수령액도 모킹된 세전 이자(999)를 기준으로 파생된다.
    expect(result.afterTaxMaturityAmount).toBe(result.totalPrincipal + result.afterTaxInterest);
  });

  it("모킹된 calculateInstallmentSimpleInterestTotal이 실제로 (월납입액, 연이율, 개월수) 인자로 호출되었는지 확인한다", async () => {
    const installmentSavings = await import("@/src/lib/installment-savings");
    const { calculateSavings } = await import("./logic");
    const input: SavingsInput = {
      mode: "savings",
      monthlyContribution: 300_000,
      annualRatePercent: 4,
      termMonths: 6,
    };
    calculateSavings(input);
    expect(installmentSavings.calculateInstallmentSimpleInterestTotal).toHaveBeenCalledWith(300_000, 4, 6);
  });
});
