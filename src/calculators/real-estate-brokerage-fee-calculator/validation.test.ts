/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — 입력 검증 실패 케이스(SPEC.md "오류와 예외
 * 처리", FORMULA.md "예외" 절 그대로, 검증 예제 24~28). 정상 계산값(Golden Test)은
 * logic.test.ts 참고(ARCHITECTURE.md "11." 배치 전략).
 */

import { describe, expect, it } from "vitest";
import {
  MAX_BASE_AMOUNT,
  MIN_BASE_AMOUNT,
  validateRealEstateBrokerageFeeInput,
  type RawRealEstateBrokerageFeeFormInput,
} from "./validation";

function baseSaleForm(): RawRealEstateBrokerageFeeFormInput {
  return { transactionType: "sale", salePrice: "500,000,000", deposit: "", monthlyRent: "" };
}

function baseLeaseForm(): RawRealEstateBrokerageFeeFormInput {
  return { transactionType: "lease", salePrice: "", deposit: "500,000,000", monthlyRent: "" };
}

describe("정상 입력 — 성공 케이스", () => {
  it("매매 모드: 유효한 매매가격이면 성공한다", () => {
    const result = validateRealEstateBrokerageFeeInput(baseSaleForm());
    expect(result).toEqual({
      success: true,
      data: { transactionType: "sale", salePrice: 500_000_000 },
    });
  });

  it("임대차 모드: 보증금만 입력(월세 없음, 전세)해도 성공하고 monthlyRent는 0이 된다", () => {
    const result = validateRealEstateBrokerageFeeInput(baseLeaseForm());
    expect(result).toEqual({
      success: true,
      data: { transactionType: "lease", deposit: 500_000_000, monthlyRent: 0 },
    });
  });

  it("임대차 모드: 월차임을 함께 입력하면 그대로 반영된다", () => {
    const result = validateRealEstateBrokerageFeeInput({
      ...baseLeaseForm(),
      monthlyRent: "500,000",
    });
    expect(result).toEqual({
      success: true,
      data: { transactionType: "lease", deposit: 500_000_000, monthlyRent: 500_000 },
    });
  });

  it("경계값(하한) 자체는 유효하다", () => {
    expect(
      validateRealEstateBrokerageFeeInput({ ...baseSaleForm(), salePrice: String(MIN_BASE_AMOUNT) })
        .success,
    ).toBe(true);
  });

  it("경계값(상한) 자체는 유효하다", () => {
    expect(
      validateRealEstateBrokerageFeeInput({ ...baseSaleForm(), salePrice: String(MAX_BASE_AMOUNT) })
        .success,
    ).toBe(true);
  });
});

describe("예제 24 — 거래 유형 미선택", () => {
  it("transactionType이 null이면 계산하지 않고 오류를 표시한다", () => {
    const result = validateRealEstateBrokerageFeeInput({
      transactionType: null,
      salePrice: "",
      deposit: "",
      monthlyRent: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual([
        { field: "transactionType", message: "거래 유형(매매/임대차)을 선택해 주세요." },
      ]);
    }
  });
});

describe("예제 25 — 매매가 0 이하", () => {
  it("salePrice=0이면 오류를 표시한다", () => {
    const result = validateRealEstateBrokerageFeeInput({ ...baseSaleForm(), salePrice: "0" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "salePrice")).toBe(true);
    }
  });

  it("salePrice가 음수 문자열이면 오류를 표시한다", () => {
    const result = validateRealEstateBrokerageFeeInput({
      ...baseSaleForm(),
      salePrice: "-1000000",
    });
    expect(result.success).toBe(false);
  });
});

describe("예제 26 — 매매가 숫자가 아님/빈 값", () => {
  it("salePrice가 빈 문자열이면 오류를 표시한다", () => {
    const result = validateRealEstateBrokerageFeeInput({ ...baseSaleForm(), salePrice: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "salePrice")).toBe(true);
    }
  });

  it("salePrice가 숫자가 아닌 문자열('abc')이면 오류를 표시한다", () => {
    const result = validateRealEstateBrokerageFeeInput({ ...baseSaleForm(), salePrice: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "salePrice")).toBe(true);
    }
  });
});

describe("예제 27 — 보증금 0 이하", () => {
  it("deposit이 음수이면 오류를 표시한다", () => {
    const result = validateRealEstateBrokerageFeeInput({
      ...baseLeaseForm(),
      deposit: "-1,000,000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "deposit")).toBe(true);
    }
  });

  it("deposit이 0이면 오류를 표시한다", () => {
    const result = validateRealEstateBrokerageFeeInput({ ...baseLeaseForm(), deposit: "0" });
    expect(result.success).toBe(false);
  });
});

describe("예제 28 — 월차임 음수", () => {
  it("monthlyRent가 음수이면 오류를 표시한다(0은 정상)", () => {
    const result = validateRealEstateBrokerageFeeInput({
      ...baseLeaseForm(),
      deposit: "50,000,000",
      monthlyRent: "-100,000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "monthlyRent")).toBe(true);
    }
  });

  it("monthlyRent가 0이면 정상 입력(전세와 동일)이다", () => {
    const result = validateRealEstateBrokerageFeeInput({
      ...baseLeaseForm(),
      deposit: "50,000,000",
      monthlyRent: "0",
    });
    expect(result.success).toBe(true);
  });

  it("monthlyRent가 숫자가 아니면 오류를 표시한다", () => {
    const result = validateRealEstateBrokerageFeeInput({
      ...baseLeaseForm(),
      deposit: "50,000,000",
      monthlyRent: "abc",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "monthlyRent")).toBe(true);
    }
  });
});

describe("계산된 값(convertedDeposit) 재검증 — ARCHITECTURE.md '6.2' 회귀 테스트", () => {
  it("deposit 자체는 상한 이내여도 monthlyRent가 커서 convertedDeposit이 상한(1조원)을 넘으면 오류", () => {
    // deposit=1,000,000(하한과 같음, 그 자체로는 유효) + monthlyRent=100,000,000,000
    //   → raw100 = 1,000,000 + 100,000,000,000 × 100 = 10,000,001,000,000(1조원 초과).
    const result = validateRealEstateBrokerageFeeInput({
      transactionType: "lease",
      salePrice: "",
      deposit: "1,000,000",
      monthlyRent: "100,000,000,000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "monthlyRent")).toBe(true);
    }
  });

  it("deposit·monthlyRent 각각은 상한 이내여도 합산된 convertedDeposit이 상한을 넘으면 오류", () => {
    const result = validateRealEstateBrokerageFeeInput({
      transactionType: "lease",
      salePrice: "",
      deposit: "999,000,000,000", // 9,990억원(그 자체로는 상한 이내)
      monthlyRent: "200,000,000", // 2억원(그 자체로는 매우 큰 값이지만 상한 검사 대상 아님)
    });
    // raw100 = 999,000,000,000 + 200,000,000 × 100 = 999,000,000,000 + 20,000,000,000
    //        = 1,019,000,000,000(1조원 초과)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "monthlyRent")).toBe(true);
    }
  });

  it("convertedDeposit이 상한 이내이면 정상 통과한다(회귀 방지 대조군)", () => {
    const result = validateRealEstateBrokerageFeeInput({
      transactionType: "lease",
      salePrice: "",
      deposit: "1,000,000",
      monthlyRent: "1,000,000",
    });
    // raw100 = 1,000,000 + 1,000,000 × 100 = 101,000,000(상한 이내)
    expect(result.success).toBe(true);
  });
});
