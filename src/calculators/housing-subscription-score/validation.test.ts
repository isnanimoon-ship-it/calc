import { describe, expect, it } from "vitest";
import {
  validateHousingSubscriptionScoreInput,
  type RawHousingSubscriptionScoreFormInput,
} from "./validation";

const VALID: RawHousingSubscriptionScoreFormInput = {
  baseDate: "2026-09-06",
  birthDate: "1990-01-01",
  isMarried: false,
  marriageDate: "",
  housingStatus: "never_owned",
  mostRecentDisposalDate: "",
  smallLowValueHomeException: false,
  hasQualifyingSpouseInHousehold: false,
  qualifyingAscendantCount: "0",
  qualifyingDescendantCount: "0",
  hasSubscriptionAccount: false,
  subscriptionAccountOpenDate: "",
};

function raw(overrides: Partial<RawHousingSubscriptionScoreFormInput>) {
  return { ...VALID, ...overrides };
}

function fieldsOf(result: ReturnType<typeof validateHousingSubscriptionScoreInput>): string[] {
  if (result.success) return [];
  return result.errors.map((e) => e.field);
}

describe("validateHousingSubscriptionScoreInput — 정상 케이스", () => {
  it("기본 입력값은 통과한다", () => {
    const result = validateHousingSubscriptionScoreInput(VALID);
    expect(result.success).toBe(true);
  });

  it("혼인·처분·청약통장 조건부 필드를 모두 채우면 통과한다", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({
        isMarried: true,
        marriageDate: "2019-05-01",
        housingStatus: "disposed",
        mostRecentDisposalDate: "2020-01-01",
        hasSubscriptionAccount: true,
        subscriptionAccountOpenDate: "2016-01-10",
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("validateHousingSubscriptionScoreInput — 필수값 누락", () => {
  it("baseDate 누락", () => {
    expect(fieldsOf(validateHousingSubscriptionScoreInput(raw({ baseDate: "" })))).toContain(
      "baseDate",
    );
  });

  it("birthDate 누락", () => {
    expect(fieldsOf(validateHousingSubscriptionScoreInput(raw({ birthDate: "" })))).toContain(
      "birthDate",
    );
  });

  it("housingStatus 미선택", () => {
    expect(
      fieldsOf(validateHousingSubscriptionScoreInput(raw({ housingStatus: "" }))),
    ).toContain("housingStatus");
  });

  it("isMarried=true인데 marriageDate 누락", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ isMarried: true, marriageDate: "" }),
    );
    expect(fieldsOf(result)).toContain("marriageDate");
  });

  it("housingStatus='disposed'인데 mostRecentDisposalDate 누락", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ housingStatus: "disposed", mostRecentDisposalDate: "" }),
    );
    expect(fieldsOf(result)).toContain("mostRecentDisposalDate");
  });

  it("hasSubscriptionAccount=true인데 subscriptionAccountOpenDate 누락", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ hasSubscriptionAccount: true, subscriptionAccountOpenDate: "" }),
    );
    expect(fieldsOf(result)).toContain("subscriptionAccountOpenDate");
  });

  it("isMarried=false면 marriageDate가 비어 있어도 통과한다(조건부 필수 아님)", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ isMarried: false, marriageDate: "" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("validateHousingSubscriptionScoreInput — 날짜 형식/논리 오류", () => {
  it("잘못된 날짜 형식(2024-02-30)", () => {
    expect(
      fieldsOf(validateHousingSubscriptionScoreInput(raw({ birthDate: "2024-02-30" }))),
    ).toContain("birthDate");
  });

  it("birthDate가 baseDate보다 미래이면 오류", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ baseDate: "2020-01-01", birthDate: "2021-01-01" }),
    );
    expect(fieldsOf(result)).toContain("birthDate");
  });

  it("birthDate가 1900-01-01 이전이면 오류", () => {
    const result = validateHousingSubscriptionScoreInput(raw({ birthDate: "1899-12-31" }));
    expect(fieldsOf(result)).toContain("birthDate");
  });

  it("baseDate가 오늘로부터 5년을 초과하면 오류", () => {
    const result = validateHousingSubscriptionScoreInput(raw({ baseDate: "2099-01-01" }));
    expect(fieldsOf(result)).toContain("baseDate");
  });

  it("marriageDate가 birthDate보다 이전이면 오류", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ isMarried: true, birthDate: "1990-01-01", marriageDate: "1989-01-01" }),
    );
    expect(fieldsOf(result)).toContain("marriageDate");
  });

  it("marriageDate가 baseDate보다 미래이면 오류", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ isMarried: true, baseDate: "2020-01-01", marriageDate: "2021-01-01" }),
    );
    expect(fieldsOf(result)).toContain("marriageDate");
  });

  it("mostRecentDisposalDate가 birthDate보다 이전이면 오류", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({
        housingStatus: "disposed",
        birthDate: "1990-01-01",
        mostRecentDisposalDate: "1980-01-01",
      }),
    );
    expect(fieldsOf(result)).toContain("mostRecentDisposalDate");
  });

  it("subscriptionAccountOpenDate가 baseDate보다 미래이면 오류", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({
        hasSubscriptionAccount: true,
        baseDate: "2020-01-01",
        subscriptionAccountOpenDate: "2021-01-01",
      }),
    );
    expect(fieldsOf(result)).toContain("subscriptionAccountOpenDate");
  });

  it("subscriptionAccountOpenDate가 birthDate보다 이전이면 오류", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({
        hasSubscriptionAccount: true,
        birthDate: "1990-01-01",
        subscriptionAccountOpenDate: "1985-01-01",
      }),
    );
    expect(fieldsOf(result)).toContain("subscriptionAccountOpenDate");
  });
});

describe("validateHousingSubscriptionScoreInput — 부양가족 수 검증", () => {
  it("음수 직계존속 수는 오류", () => {
    expect(
      fieldsOf(validateHousingSubscriptionScoreInput(raw({ qualifyingAscendantCount: "-1" }))),
    ).toContain("qualifyingAscendantCount");
  });

  it("소수 직계비속 수는 오류", () => {
    expect(
      fieldsOf(validateHousingSubscriptionScoreInput(raw({ qualifyingDescendantCount: "1.5" }))),
    ).toContain("qualifyingDescendantCount");
  });

  it("직계존속 수가 상식적 상한(4명)을 넘으면 오류", () => {
    expect(
      fieldsOf(validateHousingSubscriptionScoreInput(raw({ qualifyingAscendantCount: "5" }))),
    ).toContain("qualifyingAscendantCount");
  });

  it("직계비속 수가 상식적 상한(10명)을 넘으면 오류", () => {
    expect(
      fieldsOf(validateHousingSubscriptionScoreInput(raw({ qualifyingDescendantCount: "11" }))),
    ).toContain("qualifyingDescendantCount");
  });

  it("숫자가 아닌 문자열은 오류", () => {
    expect(
      fieldsOf(validateHousingSubscriptionScoreInput(raw({ qualifyingAscendantCount: "abc" }))),
    ).toContain("qualifyingAscendantCount");
  });

  it("6명 초과 입력(예: 9명 상당)은 검증을 통과한다 — 상한 캡은 logic.ts 몫", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({
        isMarried: true,
        marriageDate: "2019-05-01",
        hasQualifyingSpouseInHousehold: true,
        qualifyingAscendantCount: "4",
        qualifyingDescendantCount: "4",
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("validateHousingSubscriptionScoreInput — 조건부 필드가 false/미해당일 때 정규화", () => {
  it("housingStatus!=='currently_owns'이면 smallLowValueHomeException은 항상 false로 정규화된다", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ housingStatus: "never_owned", smallLowValueHomeException: true }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.smallLowValueHomeException).toBe(false);
    }
  });

  it("isMarried=false이면 hasQualifyingSpouseInHousehold는 항상 false로 정규화된다", () => {
    const result = validateHousingSubscriptionScoreInput(
      raw({ isMarried: false, hasQualifyingSpouseInHousehold: true }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasQualifyingSpouseInHousehold).toBe(false);
    }
  });
});
