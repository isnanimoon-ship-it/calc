import { describe, expect, it } from "vitest";
import { compareDecimalStrings } from "./decimal-scale";
import { calculateAverageCost, restoreAverageCostResult } from "./logic";
import type { AverageCostCalculatorInput } from "./types";

/**
 * tasks/average-cost-calculator/FORMULA.md "검증 예제" 1~10을 그대로 옮긴 Golden Test다.
 * 외부 출처 대조 3건(예제 1·2·3)은 서로 다른 2개 도메인의 실제 계산 예시와 대조했다
 * (brainc.me, Plus27/makeit27.com — 확인일 2026-09-12, FORMULA.md "기준/출처" 참고).
 *
 * `DecimalString` 비교는 문자열 사전식 비교(`<`/`>`)가 아니라 `compareDecimalStrings`로
 * 한다(ARCHITECTURE.md "logic.test.ts에서 DecimalString 비교 시 주의" — "9" > "10"이
 * 사전식으로는 참이 되는 함정을 피하기 위함). 정확히 일치해야 하는 기대값은 포맷된
 * 문자열("7,500")이 아니라 포맷 이전의 원본 DecimalString("7500")과 비교한다.
 */

describe("calculateAverageCost — Golden Test (FORMULA.md 검증 예제 1~10)", () => {
  it("예제 1 — 물타기 기본 (외부 출처 대조 ①: brainc.me, 확인일 2026-09-12)", () => {
    const result = calculateAverageCost({
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "10",
      additionalPrice: "5000",
    });
    expect(result.newAveragePrice).toBe("7500");
    expect(result.totalQty).toBe("20");
    expect(result.totalCost).toBe("150000");
    expect(result.direction).toBe("하락");
  });

  it("예제 2 — 불타기 기본 (외부 출처 대조 ②: brainc.me, 같은 페이지 두 번째 예시)", () => {
    const result = calculateAverageCost({
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "10",
      additionalPrice: "15000",
    });
    expect(result.newAveragePrice).toBe("12500");
    expect(result.totalQty).toBe("20");
    expect(result.totalCost).toBe("250000");
    expect(result.direction).toBe("상승");
  });

  it("예제 3 — 수량이 다른 정수 케이스 (외부 출처 대조 ③: Plus27/makeit27.com, 다른 도메인)", () => {
    const result = calculateAverageCost({
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "15",
      additionalPrice: "8000",
    });
    expect(result.newAveragePrice).toBe("8800");
    expect(result.totalQty).toBe("25");
    expect(result.totalCost).toBe("220000");
    expect(result.direction).toBe("하락");
  });

  it("예제 4 — 변동 없음 경계값(대수적 항등식)", () => {
    const result = calculateAverageCost({
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "5",
      additionalPrice: "10000",
    });
    expect(result.newAveragePrice).toBe("10000");
    expect(result.direction).toBe("변동없음");
    expect(result.isRoundedToZeroButChanged).toBe(false);
  });

  it("예제 5 — 코인 소수 수량, 정확히 나누어떨어지는 케이스", () => {
    const result = calculateAverageCost({
      holdingQty: "0.5",
      holdingPrice: "52340000",
      additionalQty: "0.25",
      additionalPrice: "41150000",
    });
    expect(result.newAveragePrice).toBe("48610000");
    expect(result.totalQty).toBe("0.75");
    expect(result.totalCost).toBe("36457500");
    expect(result.direction).toBe("하락");
  });

  it("예제 6 — 코인 소수 수량, 무한소수 → 반올림 필요(핵심 정밀도 검증)", () => {
    const result = calculateAverageCost({
      holdingQty: "0.00012345",
      holdingPrice: "90000000",
      additionalQty: "0.00007656",
      additionalPrice: "80000000",
    });
    // 정확한 값 ≈ 86,172,191.39048...원 → priceResultDecimals=0이므로 내림(0.5 미만).
    expect(result.newAveragePrice).toBe("86172191");
    expect(result.totalQty).toBe("0.00020001");
    // totalCost의 완전정밀도 원본은 17,235.3원 → 0자리로 사사오입해 17235(올림 아님, .3<.5).
    expect(result.totalCost).toBe("17235");
    expect(result.direction).toBe("하락");
  });

  it('예제 7 — "변동 없음처럼 보이지만 실제로는 미세 하락"(모순 방지 규칙 검증)', () => {
    const result = calculateAverageCost({
      holdingQty: "100000",
      holdingPrice: "10000",
      additionalQty: "1",
      additionalPrice: "9000",
    });
    // 정확한 값 ≈ 9,999.9900001원 → 0자리로 사사오입하면 10,000원(holdingPrice와 표시상 동일).
    expect(result.newAveragePrice).toBe("10000");
    // 그럼에도 direction은 절대 "변동없음"으로 바뀌지 않는다 — 입력값 비교(9000<10000)로 확정.
    expect(result.direction).toBe("하락");
    expect(result.priceChangeAmount).toBe("0");
    expect(result.isRoundedToZeroButChanged).toBe(true);
  });

  it("예제 8 — 수렴성 ① 추가수량이 보유수량 대비 매우 작음", () => {
    const result = calculateAverageCost({
      holdingQty: "99",
      holdingPrice: "10000",
      additionalQty: "1",
      additionalPrice: "100",
    });
    expect(result.newAveragePrice).toBe("9901");
    expect(result.direction).toBe("하락");
  });

  it("예제 9 — 수렴성 ② 추가수량이 보유수량 대비 매우 큼(예제 8과 대칭)", () => {
    const result = calculateAverageCost({
      holdingQty: "1",
      holdingPrice: "10000",
      additionalQty: "99",
      additionalPrice: "100",
    });
    expect(result.newAveragePrice).toBe("199");
    expect(result.direction).toBe("하락");
  });

  it("예제 10 — 입력 상한 극단값 + 정확히 0.5 반올림 경계(BigInt 필요성 실증)", () => {
    const result = calculateAverageCost({
      holdingQty: "1000000000000000", // 10^15, 상한
      holdingPrice: "10000000000", // 100억원, 상한
      additionalQty: "1000000000000000", // 10^15, 상한
      additionalPrice: "1",
    });
    // 정확한 값 = 10,000,000,001/2 = 5,000,000,000.5 → 사사오입(항상 올림)이므로
    // 5,000,000,001원. 은행반올림(round-half-to-even)이었다면 5,000,000,000이 나와야 한다.
    expect(result.newAveragePrice).toBe("5000000001");
    expect(result.direction).toBe("하락");
  });
});

describe("calculateAverageCost — 완료 기준 불변식(compareDecimalStrings로 검증)", () => {
  const cases: AverageCostCalculatorInput[] = [
    { holdingQty: "10", holdingPrice: "10000", additionalQty: "10", additionalPrice: "5000" },
    { holdingQty: "10", holdingPrice: "10000", additionalQty: "10", additionalPrice: "15000" },
    { holdingQty: "0.00012345", holdingPrice: "90000000", additionalQty: "0.00007656", additionalPrice: "80000000" },
    { holdingQty: "99", holdingPrice: "10000", additionalQty: "1", additionalPrice: "100" },
    { holdingQty: "1", holdingPrice: "10000", additionalQty: "99", additionalPrice: "100" },
    {
      holdingQty: "1000000000000000",
      holdingPrice: "10000000000",
      additionalQty: "1000000000000000",
      additionalPrice: "1",
    },
  ];

  it.each(cases)(
    "새 평단가는 항상 min(holdingPrice, additionalPrice)와 max(...) 사이에 있다: %j",
    (input) => {
      const result = calculateAverageCost(input);
      const lower =
        compareDecimalStrings(input.holdingPrice, input.additionalPrice) <= 0 ? input.holdingPrice : input.additionalPrice;
      const upper =
        compareDecimalStrings(input.holdingPrice, input.additionalPrice) <= 0 ? input.additionalPrice : input.holdingPrice;
      expect(compareDecimalStrings(result.newAveragePrice, lower)).toBeGreaterThanOrEqual(0);
      expect(compareDecimalStrings(result.newAveragePrice, upper)).toBeLessThanOrEqual(0);
    },
  );

  it("추가매수단가 < 보유평단가 → 새 평단가 < 보유평단가(엄격한 하락)", () => {
    const result = calculateAverageCost({
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "10",
      additionalPrice: "5000",
    });
    expect(result.direction).toBe("하락");
    expect(compareDecimalStrings(result.newAveragePrice, "10000")).toBe(-1);
  });

  it("추가매수단가 > 보유평단가 → 새 평단가 > 보유평단가(엄격한 상승)", () => {
    const result = calculateAverageCost({
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "10",
      additionalPrice: "15000",
    });
    expect(result.direction).toBe("상승");
    expect(compareDecimalStrings(result.newAveragePrice, "10000")).toBe(1);
  });

  it("추가매수단가 = 보유평단가 → 새 평단가 = 보유평단가(변동없음, 대수적 항등식)", () => {
    const result = calculateAverageCost({
      holdingQty: "123.456",
      holdingPrice: "77777",
      additionalQty: "9.5",
      additionalPrice: "77777",
    });
    expect(result.direction).toBe("변동없음");
    expect(compareDecimalStrings(result.newAveragePrice, "77777")).toBe(0);
    expect(result.priceChangeAmount).toBe("0");
  });

  it("총 보유수량/총 투자원금이 정의된 그대로 성립한다(합산 검증)", () => {
    const result = calculateAverageCost({
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "15",
      additionalPrice: "8000",
    });
    expect(result.totalQty).toBe("25"); // 10+15
    expect(result.totalCost).toBe("220000"); // 10*10000 + 15*8000
  });

  it("추가수량이 보유수량 대비 극단적으로 작으면 새 평단가는 보유평단가에 수렴한다", () => {
    const result = calculateAverageCost({
      holdingQty: "1000000",
      holdingPrice: "10000",
      additionalQty: "1",
      additionalPrice: "1",
    });
    // 거의 전량이 기존 보유분이므로 보유평단가(10000)에 매우 가깝다.
    expect(compareDecimalStrings(result.newAveragePrice, "9990")).toBeGreaterThanOrEqual(0);
    expect(compareDecimalStrings(result.newAveragePrice, "10000")).toBeLessThanOrEqual(0);
  });

  it("추가수량이 보유수량을 압도하면 새 평단가는 추가매수단가에 수렴한다", () => {
    const result = calculateAverageCost({
      holdingQty: "1",
      holdingPrice: "10000",
      additionalQty: "1000000",
      additionalPrice: "1",
    });
    expect(compareDecimalStrings(result.newAveragePrice, "1")).toBeGreaterThanOrEqual(0);
    expect(compareDecimalStrings(result.newAveragePrice, "11")).toBeLessThanOrEqual(0);
  });
});

describe("restoreAverageCostResult — 공유 URL 복원(RNG 없음, 입력이 같으면 결과도 같다)", () => {
  it("calculateAverageCost와 동일한 결과를 재현한다", () => {
    const input: AverageCostCalculatorInput = {
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "10",
      additionalPrice: "5000",
    };
    expect(restoreAverageCostResult(input)).toEqual(calculateAverageCost(input));
  });
});

describe("Edge Case — 매우 작은 값(예제 배경: 0.00000001)도 오차 없이 처리한다", () => {
  it("최소 표현 단위(1e-8) 수량도 정확히 계산한다", () => {
    const result = calculateAverageCost({
      holdingQty: "0.00000001",
      holdingPrice: "100000000",
      additionalQty: "0.00000001",
      additionalPrice: "100000000",
    });
    expect(result.newAveragePrice).toBe("100000000");
    expect(result.totalQty).toBe("0.00000002");
    expect(result.direction).toBe("변동없음");
  });
});
