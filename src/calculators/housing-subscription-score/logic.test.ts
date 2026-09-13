import { describe, expect, it } from "vitest";
import { calculateHousingSubscriptionScore } from "./logic";
import type { HousingSubscriptionScoreInput } from "./types";

/**
 * Golden Test — tasks/housing-subscription-score/FORMULA.md "검증 예제 (Golden Test 후보,
 * 14개)"를 그대로 옮긴다. 예제 번호를 주석에 명시해 FORMULA.md와 1:1로 대조할 수 있게 한다.
 * 예제 13·14(2026-09-06 Formula Analyst 추가, 윤년 2월 29일 clamp 회귀 테스트)는
 * Calculation Auditor가 지적한 Medium 이슈(`ageThirtyDate()`의 3월 1일 오정규화)에 대한
 * Optimizer 수정 검증용이다.
 */

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

describe("calculateHousingSubscriptionScore — Golden Test (FORMULA.md 검증 예제 14개)", () => {
  it("예제 1 — 만 30세 생일 당일(경과 0일): homelessPeriodScore=2", () => {
    const result = calculateHousingSubscriptionScore(
      input({ birthDate: "1996-09-06", isMarried: false, housingStatus: "never_owned" }),
    );
    expect(result.homelessEligible).toBe(true);
    expect(result.homelessPeriodYears).toBe(0);
    expect(result.homelessPeriodScore).toBe(2);
  });

  it("예제 2 — 만 30세 생일 하루 전(미혼): homelessPeriodScore=0, 사유=underAgeUnmarried", () => {
    const result = calculateHousingSubscriptionScore(
      input({ birthDate: "1996-09-07", isMarried: false, housingStatus: "never_owned" }),
    );
    expect(result.homelessEligible).toBe(false);
    expect(result.homelessPeriodScore).toBe(0);
    expect(result.homelessIneligibleReasons).toContain("underAgeUnmarried");
  });

  it("예제 3 — 만 1년 정확 경계(30세 생일로부터 정확히 1년): homelessPeriodScore=4", () => {
    const result = calculateHousingSubscriptionScore(
      input({ birthDate: "1995-09-06", isMarried: false, housingStatus: "never_owned" }),
    );
    expect(result.homelessPeriodYears).toBe(1);
    expect(result.homelessPeriodScore).toBe(4);
  });

  it("예제 4 — 만 1년 하루 전(경계 바로 아래): homelessPeriodScore=2", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        baseDate: "2026-09-05",
        birthDate: "1995-09-06",
        isMarried: false,
        housingStatus: "never_owned",
      }),
    );
    expect(result.homelessPeriodYears).toBe(0);
    expect(result.homelessPeriodScore).toBe(2);
  });

  it("예제 5 — 6년대 구간(상한 캡 이전): homelessPeriodScore=14", () => {
    const result = calculateHousingSubscriptionScore(
      input({ birthDate: "1990-01-01", isMarried: false, housingStatus: "never_owned" }),
    );
    expect(result.homelessPeriodYears).toBe(6);
    expect(result.homelessPeriodScore).toBe(14);
  });

  it("예제 6 — 20년 경과해도 32점 캡(상한 불변식)", () => {
    const result = calculateHousingSubscriptionScore(
      input({ birthDate: "1976-09-06", isMarried: false, housingStatus: "never_owned" }),
    );
    expect(result.homelessPeriodYears).toBe(20);
    expect(result.homelessPeriodScore).toBe(32);
    expect(result.homelessPeriodCapped).toBe(true);
  });

  it("예제 7 — 부양가족수 0명: dependentScore=5(0점 아님)", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        hasQualifyingSpouseInHousehold: false,
        qualifyingAscendantCount: 0,
        qualifyingDescendantCount: 0,
      }),
    );
    expect(result.dependentCount).toBe(0);
    expect(result.dependentScore).toBe(5);
  });

  it("예제 8 — 부양가족수 6명 이상 상한 캡(6명과 7명이 동일 점수)", () => {
    const resultA = calculateHousingSubscriptionScore(
      input({
        hasQualifyingSpouseInHousehold: true,
        qualifyingAscendantCount: 2,
        qualifyingDescendantCount: 3,
      }),
    );
    const resultB = calculateHousingSubscriptionScore(
      input({
        hasQualifyingSpouseInHousehold: true,
        qualifyingAscendantCount: 2,
        qualifyingDescendantCount: 4,
      }),
    );
    expect(resultA.dependentCount).toBe(6);
    expect(resultA.dependentScore).toBe(35);
    expect(resultB.dependentCount).toBe(7);
    expect(resultB.dependentScore).toBe(35);
  });

  it("예제 9 — 청약통장 가입기간 6개월 미만/정확 6개월 경계", () => {
    const resultA = calculateHousingSubscriptionScore(
      input({
        hasSubscriptionAccount: true,
        subscriptionAccountOpenDate: "2026-03-07",
      }),
    );
    const resultB = calculateHousingSubscriptionScore(
      input({
        hasSubscriptionAccount: true,
        subscriptionAccountOpenDate: "2026-03-06",
      }),
    );
    expect(resultA.subscriptionPeriodMonths).toBe(5);
    expect(resultA.subscriptionPeriodScore).toBe(1);
    expect(resultB.subscriptionPeriodMonths).toBe(6);
    expect(resultB.subscriptionPeriodScore).toBe(2);
  });

  it("예제 10 — 청약통장 가입기간 만 1년 정확 경계: subscriptionPeriodScore=3", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        hasSubscriptionAccount: true,
        subscriptionAccountOpenDate: "2025-09-06",
      }),
    );
    expect(result.subscriptionPeriodMonths).toBe(12);
    expect(result.subscriptionPeriodScore).toBe(3);
  });

  it("예제 11 — 청약통장 가입기간 15년 이상 상한 캡: subscriptionPeriodScore=17", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        hasSubscriptionAccount: true,
        subscriptionAccountOpenDate: "2006-01-01",
      }),
    );
    expect(result.subscriptionPeriodMonths).toBe(248);
    expect(result.subscriptionPeriodScore).toBe(17);
    expect(result.subscriptionPeriodCapped).toBe(true);
  });

  it("예제 12 — 종합 시나리오(세 항목 합산): totalScore=48", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        birthDate: "1991-06-15",
        isMarried: true,
        marriageDate: "2019-05-01",
        housingStatus: "never_owned",
        hasQualifyingSpouseInHousehold: true,
        qualifyingAscendantCount: 1,
        qualifyingDescendantCount: 1,
        hasSubscriptionAccount: true,
        subscriptionAccountOpenDate: "2016-01-10",
      }),
    );
    expect(result.homelessPeriodScore).toBe(16);
    expect(result.dependentScore).toBe(20);
    expect(result.subscriptionPeriodScore).toBe(12);
    expect(result.totalScore).toBe(48);
  });

  it("예제 13 — 2월 29일생(1996년), 30세가 되는 해(2026)가 평년: clamp 경계 하루 전=0점", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        baseDate: "2026-02-27",
        birthDate: "1996-02-29",
        isMarried: false,
        housingStatus: "never_owned",
      }),
    );
    expect(result.homelessEligible).toBe(false);
    expect(result.homelessPeriodScore).toBe(0);
    expect(result.homelessIneligibleReasons).toContain("underAgeUnmarried");
  });

  it("예제 13 — 2월 29일생(1996년), clamp된 정확한 날(2026-02-28)=2점", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        baseDate: "2026-02-28",
        birthDate: "1996-02-29",
        isMarried: false,
        housingStatus: "never_owned",
      }),
    );
    expect(result.homelessStartDate).toBe("2026-02-28");
    expect(result.homelessEligible).toBe(true);
    expect(result.homelessPeriodYears).toBe(0);
    expect(result.homelessPeriodScore).toBe(2);
  });

  it("예제 14 — 2월 29일생(2000년, 400배수 윤년), clamp 경계 하루 전=0점", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        baseDate: "2030-02-27",
        birthDate: "2000-02-29",
        isMarried: false,
        housingStatus: "never_owned",
      }),
    );
    expect(result.homelessEligible).toBe(false);
    expect(result.homelessPeriodScore).toBe(0);
    expect(result.homelessIneligibleReasons).toContain("underAgeUnmarried");
  });

  it("예제 14 — 2월 29일생(2000년), clamp된 정확한 날(2030-02-28)=2점", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        baseDate: "2030-02-28",
        birthDate: "2000-02-29",
        isMarried: false,
        housingStatus: "never_owned",
      }),
    );
    expect(result.homelessStartDate).toBe("2030-02-28");
    expect(result.homelessEligible).toBe(true);
    expect(result.homelessPeriodYears).toBe(0);
    expect(result.homelessPeriodScore).toBe(2);
  });
});

describe("calculateHousingSubscriptionScore — 총점/항목별 상한 불변식(SPEC.md 완료 기준)", () => {
  const scenarios: { name: string; overrides: Partial<HousingSubscriptionScoreInput> }[] = [
    { name: "기본값(모두 최소)", overrides: {} },
    {
      name: "모든 항목 최댓값 근처",
      overrides: {
        birthDate: "1960-01-01",
        isMarried: true,
        marriageDate: "1985-01-01",
        housingStatus: "never_owned",
        hasQualifyingSpouseInHousehold: true,
        qualifyingAscendantCount: 4,
        qualifyingDescendantCount: 10,
        hasSubscriptionAccount: true,
        subscriptionAccountOpenDate: "1980-01-01",
      },
    },
    {
      name: "현재 주택 소유 중(무주택 요건 미충족)",
      overrides: { housingStatus: "currently_owns", smallLowValueHomeException: true },
    },
    {
      name: "청약통장 미가입",
      overrides: { hasSubscriptionAccount: false },
    },
  ];

  it.each(scenarios)("$name — totalScore가 0~84 범위 안에 있다", ({ overrides }) => {
    const result = calculateHousingSubscriptionScore(input(overrides));
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(84);
    expect(result.homelessPeriodScore).toBeGreaterThanOrEqual(0);
    expect(result.homelessPeriodScore).toBeLessThanOrEqual(32);
    expect(result.dependentScore).toBeGreaterThanOrEqual(5);
    expect(result.dependentScore).toBeLessThanOrEqual(35);
    expect(result.subscriptionPeriodScore).toBeGreaterThanOrEqual(0);
    expect(result.subscriptionPeriodScore).toBeLessThanOrEqual(17);
  });

  it("totalScore는 항상 세 항목 점수의 정확한 합이다", () => {
    for (const { overrides } of scenarios) {
      const result = calculateHousingSubscriptionScore(input(overrides));
      expect(result.totalScore).toBe(
        result.homelessPeriodScore + result.dependentScore + result.subscriptionPeriodScore,
      );
    }
  });

  it("극단적으로 큰 부양가족 수를 입력해도 35점을 넘지 않는다(캡 불변식)", () => {
    const result = calculateHousingSubscriptionScore(
      input({
        hasQualifyingSpouseInHousehold: true,
        qualifyingAscendantCount: 4,
        qualifyingDescendantCount: 10,
      }),
    );
    expect(result.dependentCount).toBe(15);
    expect(result.dependentScore).toBe(35);
    expect(result.dependentCountCapped).toBe(true);
  });
});

describe("calculateHousingSubscriptionScore — 예외 케이스(FORMULA.md '예외' 절)", () => {
  it("housingStatus='currently_owns'이면 homelessEligible=false, homelessStartDate=null", () => {
    const result = calculateHousingSubscriptionScore(
      input({ birthDate: "1980-01-01", housingStatus: "currently_owns" }),
    );
    expect(result.homelessEligible).toBe(false);
    expect(result.homelessPeriodScore).toBe(0);
    expect(result.homelessIneligibleReasons).toContain("currentlyOwns");
    expect(result.homelessStartDate).toBeNull();
  });

  it("만 30세 미만이면서 동시에 현재 주택 소유 중이면 두 사유가 모두 담긴다(배타적이지 않음)", () => {
    const result = calculateHousingSubscriptionScore(
      input({ birthDate: "2000-01-01", baseDate: "2026-09-06", housingStatus: "currently_owns" }),
    );
    expect(result.homelessIneligibleReasons).toEqual(
      expect.arrayContaining(["underAgeUnmarried", "currentlyOwns"]),
    );
  });

  it("청약통장 미가입이면 subscriptionPeriodScore=0, subscriptionPeriodMonths=0", () => {
    const result = calculateHousingSubscriptionScore(
      input({ hasSubscriptionAccount: false, subscriptionAccountOpenDate: undefined }),
    );
    expect(result.subscriptionPeriodScore).toBe(0);
    expect(result.subscriptionPeriodMonths).toBe(0);
  });

  it("30세/혼인신고일 이후 주택 처분 이력이 있으면 기산일이 처분일로 재기산된다", () => {
    // birthDate=1980-01-01 → 30세 생일 2010-01-01(homelessStartCandidate).
    // 처분일 2020-06-15가 그보다 늦으므로 homelessStartDate는 처분일로 재기산된다.
    const result = calculateHousingSubscriptionScore(
      input({
        birthDate: "1980-01-01",
        housingStatus: "disposed",
        mostRecentDisposalDate: "2020-06-15",
      }),
    );
    expect(result.homelessEligible).toBe(true);
    expect(result.homelessStartDate).toBe("2020-06-15");
    expect(result.homelessPeriodYears).toBe(6);
    expect(result.homelessPeriodScore).toBe(14);
  });

  it("처분일이 30세/혼인신고일보다 이전이면 기산일에 영향을 주지 않는다", () => {
    // 처분일(1970-01-01)이 30세 생일(2010-01-01)보다 훨씬 이르므로 max()가 여전히 30세 생일을 택한다.
    const result = calculateHousingSubscriptionScore(
      input({
        birthDate: "1980-01-01",
        housingStatus: "disposed",
        mostRecentDisposalDate: "1970-01-01",
      }),
    );
    expect(result.homelessStartDate).toBe("2010-01-01");
  });

  it("혼인신고일이 30세 생일보다 늦으면(30세 이후 혼인) 30세 생일부터 기산한다", () => {
    // FORMULA.md 공식 1단계: isMarried && marriageDate < ageStartDate 조건이 거짓이면 ageStartDate를 쓴다.
    const result = calculateHousingSubscriptionScore(
      input({
        birthDate: "1990-01-01", // 30세 생일 2020-01-01
        isMarried: true,
        marriageDate: "2022-01-01", // 30세 생일보다 늦은 혼인
        housingStatus: "never_owned",
      }),
    );
    expect(result.homelessStartDate).toBe("2020-01-01");
  });
});
