import { describe, expect, it } from "vitest";
import {
  compareDecimalStrings,
  countDecimalPlaces,
  divRoundHalfUp,
  fromScaledBigInt,
  isPlainUnsignedDecimal,
  SCALE_DECIMALS,
  SCALE_FACTOR,
  toScaledBigInt,
} from "./decimal-scale";

/**
 * decimal-scale.ts 순수 산술 단위 테스트. FORMULA.md 골든 예제와 무관하게 산술 자체의
 * 자기증명적 정답(수학적으로 명백한 값)을 대조한다 — 공식 적용 여부는 logic.test.ts가
 * 별도로 검증한다(ARCHITECTURE.md "3.2").
 */

describe("SCALE_DECIMALS / SCALE_FACTOR", () => {
  it("스케일은 8자리, 팩터는 10^8이다(FORMULA.md 정밀도 정책)", () => {
    expect(SCALE_DECIMALS).toBe(8);
    expect(SCALE_FACTOR).toBe(100_000_000n);
  });
});

describe("isPlainUnsignedDecimal", () => {
  it.each([
    ["0", true],
    ["0.5", true],
    ["10000", true],
    ["0.00012345", true],
    ["007", true], // 선행 0은 형식상 허용(BigInt() 파싱 자체가 정확히 처리)
    ["", false],
    [".5", false], // 선행 정수부 없는 소수점은 허용하지 않는다(계약 문서 예시 그대로)
    ["5.", false], // 소수점 뒤 자릿수 없음
    ["-5", false], // 부호 없음
    ["+5", false],
    ["5.5.5", false], // 다중 소수점
    ["1e10", false], // 지수 표기
    [" 5", false], // 공백
    ["5 ", false],
    ["5,000", false], // 콤마는 이 함수 호출 전에 이미 제거되어 있어야 한다
    ["abc", false],
  ])("isPlainUnsignedDecimal(%j) === %j", (value, expected) => {
    expect(isPlainUnsignedDecimal(value)).toBe(expected);
  });
});

describe("countDecimalPlaces", () => {
  it("정수(소수점 없음)는 0", () => {
    expect(countDecimalPlaces("10000")).toBe(0);
    expect(countDecimalPlaces("0")).toBe(0);
  });
  it("소수부 자릿수를 그대로 센다", () => {
    expect(countDecimalPlaces("0.5")).toBe(1);
    expect(countDecimalPlaces("0.00012345")).toBe(8);
    expect(countDecimalPlaces("123.4500")).toBe(4);
  });
});

describe("toScaledBigInt — 문자열 기반 스케일링(parseFloat/Number 미경유)", () => {
  it("정수 입력", () => {
    expect(toScaledBigInt("10000")).toBe(1_000_000_000_000n); // 10000 × 10^8
    expect(toScaledBigInt("0")).toBe(0n);
  });
  it("소수 입력 — 우측 0-패딩", () => {
    expect(toScaledBigInt("0.5")).toBe(50_000_000n); // 0.5 × 10^8
    expect(toScaledBigInt("0.00012345")).toBe(12_345n);
  });
  it("8자리 경계 — 정확히 8자리는 허용, 9자리는 예외", () => {
    expect(toScaledBigInt("0.12345678")).toBe(12_345_678n);
    expect(() => toScaledBigInt("0.123456789")).toThrow();
  });
  it("custom scale 인자를 지원한다", () => {
    expect(toScaledBigInt("0.5", 2)).toBe(50n);
    expect(toScaledBigInt("1", 0)).toBe(1n);
  });
  it("형식이 올바르지 않은 입력은 예외를 던진다(호출부가 사전 검증을 생략한 경우의 안전망)", () => {
    expect(() => toScaledBigInt("-5")).toThrow();
    expect(() => toScaledBigInt("abc")).toThrow();
  });
  it("FORMULA.md 예시 — \"0.5\" → 정수부 \"0\" + 소수부 8자리 패딩 \"50000000\" → 50000000n", () => {
    expect(toScaledBigInt("0.5")).toBe(BigInt("050000000"));
  });
});

describe("divRoundHalfUp — 나머지 기반 사사오입(round-half-up)", () => {
  it("나머지 × 2 < 분모 → 내림", () => {
    expect(divRoundHalfUp(9n, 4n)).toBe(2n); // 9/4 = 2.25 → 내림
  });
  it("정확히 절반(.5) → 올림(은행반올림 아님, 항상 올림)", () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n); // 5/2 = 2.5 → 올림 → 3
    expect(divRoundHalfUp(10_000_000_001n, 2n)).toBe(5_000_000_001n); // FORMULA.md 검증 예제 10과 동일 구조
  });
  it("나머지 × 2 > 분모 → 올림", () => {
    expect(divRoundHalfUp(7n, 4n)).toBe(2n); // 7/4 = 1.75 → 올림 → 2
  });
  it("나누어떨어지는 경우 → 그대로", () => {
    expect(divRoundHalfUp(8n, 4n)).toBe(2n);
    expect(divRoundHalfUp(0n, 5n)).toBe(0n);
  });
});

describe("fromScaledBigInt — 반올림 없는 순수 자릿수 삽입", () => {
  it("decimals=0이면 정수 문자열 그대로", () => {
    expect(fromScaledBigInt(7500n, 0)).toBe("7500");
    expect(fromScaledBigInt(0n, 0)).toBe("0");
  });
  it("decimals>0이면 소수점을 정확한 위치에 삽입한다", () => {
    expect(fromScaledBigInt(50_000_000n, 8)).toBe("0.50000000");
    expect(fromScaledBigInt(12_345n, 8)).toBe("0.00012345");
    expect(fromScaledBigInt(123_45n, 2)).toBe("123.45");
  });
  it("음수 부호를 보존한다", () => {
    expect(fromScaledBigInt(-2500n, 0)).toBe("-2500");
    expect(fromScaledBigInt(-50_000_000n, 8)).toBe("-0.50000000");
  });
  it("0n은 부호 없이 \"0\"으로 표시한다(BigInt에는 -0이 없다)", () => {
    expect(fromScaledBigInt(0n, 2)).toBe("0.00");
    expect(fromScaledBigInt(-0n, 2)).toBe("0.00");
  });
  it("자릿수가 모자라면 왼쪽을 0으로 채운다(정수부가 0이 되는 경우)", () => {
    expect(fromScaledBigInt(5n, 4)).toBe("0.0005");
  });
});

describe("compareDecimalStrings — 자릿수가 다른 두 값도 정확히 비교(사전식 비교 금지)", () => {
  it("자릿수가 다른 정수 문자열도 수치로 정확히 비교한다", () => {
    // 문자열 사전식 비교라면 "9" > "10" (참, 함정) — 수치 비교는 반드시 거짓이어야 한다.
    expect(compareDecimalStrings("9", "10")).toBe(-1);
    expect(compareDecimalStrings("10", "9")).toBe(1);
  });
  it("소수 자릿수가 다른 값도 정확히 비교한다", () => {
    expect(compareDecimalStrings("0.5", "0.50")).toBe(0);
    expect(compareDecimalStrings("0.5", "0.6")).toBe(-1);
    expect(compareDecimalStrings("0.00012345", "0.0001")).toBe(1);
  });
  it("완전히 같은 값은 0을 반환한다", () => {
    expect(compareDecimalStrings("10000", "10000")).toBe(0);
  });
  it("custom scale 인자를 지원한다", () => {
    expect(compareDecimalStrings("1", "1.00", 2)).toBe(0);
  });
});
