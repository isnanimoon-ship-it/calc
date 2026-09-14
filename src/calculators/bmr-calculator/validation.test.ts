/**
 * 기초대사량(BMR) 계산기 — 입력 검증 Golden/Edge Case Test.
 *
 * tasks/bmr-calculator/FORMULA.md "검증 예제" 중 입력 검증 실패 케이스(#10, #12, #15,
 * #23~24)를 tasks/bmr-calculator/ARCHITECTURE.md "8. Golden Test 배치 전략"이 정한 대로
 * 이 파일에 배치한다. 정상 계산 케이스는 logic.test.ts를 참고.
 */

import { describe, expect, it } from "vitest";
import { MAX_AGE, MAX_HEIGHT_CM, MAX_WEIGHT_KG, MIN_AGE, MIN_HEIGHT_CM, MIN_WEIGHT_KG, validateBmrInput } from "./validation";
import type { RawBmrFormInput } from "./validation";

function rawInput(overrides: Partial<RawBmrFormInput> = {}): RawBmrFormInput {
  return {
    sex: "male",
    ageYears: "30",
    heightCm: "175",
    weightKg: "70",
    activityLevel: null,
    ...overrides,
  };
}

describe("입력 검증 — 경계값은 유효, 범위 밖은 실패 (Golden Test #9, #11, #13~14 재확인)", () => {
  it(`나이 하한 경계(${MIN_AGE}) 자체는 유효하다`, () => {
    const result = validateBmrInput(rawInput({ ageYears: String(MIN_AGE) }));
    expect(result.success).toBe(true);
  });

  it(`나이 상한 경계(${MAX_AGE}) 자체는 유효하다`, () => {
    const result = validateBmrInput(rawInput({ ageYears: String(MAX_AGE) }));
    expect(result.success).toBe(true);
  });

  it(`키 하한 경계(${MIN_HEIGHT_CM}) 자체는 유효하다`, () => {
    const result = validateBmrInput(rawInput({ heightCm: String(MIN_HEIGHT_CM) }));
    expect(result.success).toBe(true);
  });

  it(`키 상한 경계(${MAX_HEIGHT_CM}), 체중 상한 경계(${MAX_WEIGHT_KG}) 자체는 유효하다`, () => {
    const result = validateBmrInput(
      rawInput({ heightCm: String(MAX_HEIGHT_CM), weightKg: String(MAX_WEIGHT_KG) }),
    );
    expect(result.success).toBe(true);
  });

  it(`체중 하한 경계(${MIN_WEIGHT_KG}) 자체는 유효하다`, () => {
    const result = validateBmrInput(rawInput({ weightKg: String(MIN_WEIGHT_KG) }));
    expect(result.success).toBe(true);
  });
});

describe("#10: 나이 18세(하한 미만) — 검증 실패, 성별과 무관", () => {
  it("Male, 나이 18세는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ sex: "male", ageYears: "18" }));
    expect(result.success).toBe(false);
  });

  it("Female, 나이 18세는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ sex: "female", ageYears: "18" }));
    expect(result.success).toBe(false);
  });
});

describe("#12: 나이 79세(상한 초과) — 검증 실패", () => {
  it("나이 79세는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ ageYears: "79" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "ageYears")).toBe(true);
  });
});

describe("#15: 경계 바로 밖 입력 4종 — 각각 검증 실패", () => {
  it("키 99.9cm(하한 바로 아래)는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ heightCm: "99.9" }));
    expect(result.success).toBe(false);
  });

  it("키 230.1cm(상한 바로 위)는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ heightCm: "230.1" }));
    expect(result.success).toBe(false);
  });

  it("체중 19.9kg(하한 바로 아래)는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ weightKg: "19.9" }));
    expect(result.success).toBe(false);
  });

  it("체중 300.1kg(상한 바로 위)는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ weightKg: "300.1" }));
    expect(result.success).toBe(false);
  });
});

describe("#23: 체중 0, 음수(-5), 빈 값 — 각각 검증 실패", () => {
  it("체중 0은 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ weightKg: "0" }));
    expect(result.success).toBe(false);
  });

  it("체중 음수(-5)는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ weightKg: "-5" }));
    expect(result.success).toBe(false);
  });

  it("체중 빈 값은 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ weightKg: "" }));
    expect(result.success).toBe(false);
  });
});

describe('#24: 나이에 소수(30.5) 또는 숫자가 아닌 문자열("삼십") 입력 — 검증 실패(나이는 정수만 허용)', () => {
  it("나이 30.5(소수)는 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ ageYears: "30.5" }));
    expect(result.success).toBe(false);
  });

  it('나이 "삼십"(숫자가 아닌 문자열)은 검증 실패한다', () => {
    const result = validateBmrInput(rawInput({ ageYears: "삼십" }));
    expect(result.success).toBe(false);
  });
});

describe("성별 필수 검증", () => {
  it("성별을 선택하지 않으면 검증 실패한다", () => {
    const result = validateBmrInput(rawInput({ sex: "" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "sex")).toBe(true);
  });
});

describe("여러 필드 오류를 한 번에 모아 반환한다(bmi-calculator 관례)", () => {
  it("성별 미선택 + 나이 범위 밖 + 키/체중 범위 밖을 동시에 입력하면 4개 오류가 모두 반환된다", () => {
    const result = validateBmrInput(
      rawInput({ sex: "", ageYears: "200", heightCm: "10", weightKg: "1" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["ageYears", "heightCm", "sex", "weightKg"]);
  });
});

describe("activityLevel은 이 파일에서 검증하지 않는다(ARCHITECTURE.md 6.1 — logic.ts 책임)", () => {
  it("activityLevel: null이어도 나머지 필드가 유효하면 검증을 통과한다", () => {
    const result = validateBmrInput(rawInput({ activityLevel: null }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.activityLevel).toBeNull();
  });

  it("activityLevel: 3이면 검증 통과 데이터에 그대로 담긴다", () => {
    const result = validateBmrInput(rawInput({ activityLevel: 3 }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.activityLevel).toBe(3);
  });
});
