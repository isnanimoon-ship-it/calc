import { describe, expect, it } from "vitest";
import {
  buildHousingScoreBreakdown,
  buildHousingScoreWarnings,
  formatKoreanDate,
  formatShortDate,
} from "./formatting";
import { calculateHousingSubscriptionScore } from "./logic";
import type { HousingSubscriptionScoreInput } from "./types";

const BASE_INPUT: HousingSubscriptionScoreInput = {
  baseDate: "2026-09-06",
  birthDate: "1990-01-01",
  isMarried: false,
  marriageDate: undefined,
  housingStatus: "never_owned",
  mostRecentDisposalDate: undefined,
  smallLowValueHomeException: false,
  hasQualifyingSpouseInHousehold: false,
  qualifyingAscendantCount: 0,
  qualifyingDescendantCount: 0,
  hasSubscriptionAccount: false,
  subscriptionAccountOpenDate: undefined,
};

function input(overrides: Partial<HousingSubscriptionScoreInput>): HousingSubscriptionScoreInput {
  return { ...BASE_INPUT, ...overrides };
}

describe("formatKoreanDate / formatShortDate", () => {
  it("formatKoreanDate: YYYY-MM-DD → YYYY년 M월 D일", () => {
    expect(formatKoreanDate("2026-09-06")).toBe("2026년 9월 6일");
  });

  it("formatShortDate: YYYY-MM-DD → YYYY.MM.DD", () => {
    expect(formatShortDate("2026-09-06")).toBe("2026.09.06");
  });
});

describe("buildHousingScoreBreakdown", () => {
  it("3행(무주택기간/부양가족수/가입기간)을 순서대로 반환한다", () => {
    const applied = input({});
    const result = calculateHousingSubscriptionScore(applied);
    const rows = buildHousingScoreBreakdown(applied, result);
    expect(rows.map((r) => r.label)).toEqual([
      "무주택기간",
      "부양가족수",
      "청약통장 가입기간",
    ]);
  });

  it("무주택 요건 미충족(현재 소유 중)이면 사유 문구와 0점이 표현식에 담긴다", () => {
    const applied = input({ housingStatus: "currently_owns" });
    const result = calculateHousingSubscriptionScore(applied);
    const [homelessRow] = buildHousingScoreBreakdown(applied, result);
    expect(homelessRow.expression).toContain("현재 주택을 소유");
    expect(homelessRow.expression).toContain("0점");
  });

  it("무주택 요건 충족 시 실제 연수와 점수가 표현식에 담긴다", () => {
    const applied = input({ birthDate: "1990-01-01" });
    const result = calculateHousingSubscriptionScore(applied);
    const [homelessRow] = buildHousingScoreBreakdown(applied, result);
    expect(homelessRow.expression).toContain(`${result.homelessPeriodYears}년`);
    expect(homelessRow.expression).toContain(`${result.homelessPeriodScore}점`);
  });

  it("부양가족수 행에 배우자·직계존속·직계비속 인원수가 그대로 담긴다", () => {
    const applied = input({
      isMarried: true,
      marriageDate: "2019-05-01",
      hasQualifyingSpouseInHousehold: true,
      qualifyingAscendantCount: 1,
      qualifyingDescendantCount: 1,
    });
    const result = calculateHousingSubscriptionScore(applied);
    const [, dependentRow] = buildHousingScoreBreakdown(applied, result);
    expect(dependentRow.expression).toContain("배우자 1명");
    expect(dependentRow.expression).toContain("직계존속 1명");
    expect(dependentRow.expression).toContain("직계비속 1명");
    expect(dependentRow.expression).toContain("20점");
  });

  it("청약통장 미가입이면 가입기간 행이 '미가입' 문구와 0점을 보여준다", () => {
    const applied = input({ hasSubscriptionAccount: false });
    const result = calculateHousingSubscriptionScore(applied);
    const [, , subscriptionRow] = buildHousingScoreBreakdown(applied, result);
    expect(subscriptionRow.expression).toContain("미가입");
    expect(subscriptionRow.expression).toContain("0점");
  });

  it("청약통장 가입기간 상한 캡 시 안내 문구가 붙는다", () => {
    const applied = input({
      hasSubscriptionAccount: true,
      subscriptionAccountOpenDate: "2006-01-01",
    });
    const result = calculateHousingSubscriptionScore(applied);
    const [, , subscriptionRow] = buildHousingScoreBreakdown(applied, result);
    expect(subscriptionRow.expression).toContain("17점");
    expect(subscriptionRow.expression).toContain("상한 적용");
  });
});

describe("buildHousingScoreWarnings", () => {
  it("정상 케이스(요건 충족·통장 보유)면 경고가 없다", () => {
    const applied = input({ hasSubscriptionAccount: true, subscriptionAccountOpenDate: "2020-01-01" });
    const result = calculateHousingSubscriptionScore(applied);
    expect(buildHousingScoreWarnings(applied, result)).toEqual([]);
  });

  it("만 30세 미만 미혼이면 해당 경고 문구가 담긴다", () => {
    const applied = input({ birthDate: "2000-01-01" });
    const result = calculateHousingSubscriptionScore(applied);
    const warnings = buildHousingScoreWarnings(applied, result);
    expect(warnings.some((w) => w.includes("만 30세 미만"))).toBe(true);
  });

  it("현재 주택 소유 중이면 해당 경고 문구가 담긴다", () => {
    const applied = input({ housingStatus: "currently_owns" });
    const result = calculateHousingSubscriptionScore(applied);
    const warnings = buildHousingScoreWarnings(applied, result);
    expect(warnings.some((w) => w.includes("현재 주택을 소유"))).toBe(true);
  });

  it("청약통장 미가입이면 해당 경고 문구가 담긴다", () => {
    const applied = input({ hasSubscriptionAccount: false });
    const result = calculateHousingSubscriptionScore(applied);
    const warnings = buildHousingScoreWarnings(applied, result);
    expect(warnings.some((w) => w.includes("청약통장 미가입"))).toBe(true);
  });

  it("두 사유가 동시에 성립하면(만 30세 미만 + 현재 소유) 경고 2개가 모두 담긴다", () => {
    const applied = input({ birthDate: "2000-01-01", housingStatus: "currently_owns" });
    const result = calculateHousingSubscriptionScore(applied);
    const warnings = buildHousingScoreWarnings(applied, result);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });
});
