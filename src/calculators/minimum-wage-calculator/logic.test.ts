/**
 * 최저임금·시급↔월급 계산기 — Golden Test + Edge Case Test.
 *
 * tasks/minimum-wage-calculator/FORMULA.md v2 "검증 예제" 20개 중 로직 레벨 12개(A1~A3,
 * B1~B4, C1~C2, D1~D2, E1)를 그대로 구현한다. 나머지 8개(F1~F8, 입력 오류)는
 * validation.test.ts가 담당한다(ARCHITECTURE.md "10." — logic.ts는 검증된 입력을 전제한다).
 *
 * **[v2 재구현, 2026-09-14]** Calculation Auditor "공식 재검토 요청"으로 FORMULA.md가 v2로
 * 개정되면서 `monthlyEquivalentHours`가 정수(예: `209`)에서 소수 둘째 자리(예: `208.57`)로
 * 바뀌었다 — 이 파일의 모든 기댓값을 FORMULA.md v2가 재계산한 값으로 전면 교체했다(v1의 정수
 * 기준 기댓값은 하나도 남기지 않았다). 신규 B4는 Calculation Auditor가 제시한 반례(월급
 * 2,154,000원 사례에서 v1은 "위반", moel.go.kr 실제 판정 도구는 "정상")를 v2 정책이 실제로
 * 해소하는지 확인하는 Golden Test다.
 *
 * **공식 대조 고지(FORMULA.md 원문 재인용, 확인일 2026-09-14)**: 예제 A1의 "시급 10,320원,
 * 주 40시간" 입력값 자체는 여전히 (1) 법제처 찾기쉬운 생활법령정보(easylaw.go.kr), (2) 고용노동부
 * 보도자료(moel.go.kr, news_seq=18144), (3) 최저임금위원회 결정 현황(minimumwage.go.kr) 세
 * 개의 독립된 정부(산하) 출처가 동일한 시간급(10,320원)으로 확인해 준다. 다만 이 계산기가
 * 실제로 산출하는 "월 환산 시간·월 환산액"(208.57시간·2,152,442원)은 그 출처들의 홍보용
 * 참고 수치(209시간·2,156,880원)와 더 이상 같지 않다 — 대신 고용노동부가 실제로 운영하는
 * 최저임금 모의계산기(`moel.go.kr/miniWageMain.do`, `wageResultNew()` 함수)의 계산 방식과
 * 정합성을 맞춘 결과다(FORMULA.md "정밀도/반올림 정책 [v2]" 참고).
 *
 * 이 테스트가 "통과"한다고 Builder가 정확성을 최종 판정하는 것은 아니다 — 최종 판정은
 * Calculation Auditor의 몫이다(.claude/agents/builder.md).
 */

import { describe, expect, it } from "vitest";
import {
  APPLICABLE_RATE_YEAR,
  calculateFromHourlyWage,
  calculateFromMonthlyWage,
  calculateMinimumWageComparison,
  calculateMonthlyEquivalentHours,
  calculateMonthlyEquivalentHoursExact,
  calculateWeeklyPaidHours,
  getApplicableRates,
} from "./logic";
import { MIN_WEEKLY_HOURS } from "./validation";
import type { HourlyModeInput, MonthlyModeInput } from "./types";

const hourly = (input: Omit<HourlyModeInput, "mode">) =>
  calculateFromHourlyWage({ mode: "HOURLY", ...input });
const monthly = (input: Omit<MonthlyModeInput, "mode">) =>
  calculateFromMonthlyWage({ mode: "MONTHLY", ...input });

describe("calculateFromHourlyWage — 시급 모드 3가지 경계 (FORMULA.md v2 A1~A3)", () => {
  // 예제 A1 — 정확히 최저임금, 주 40시간(기본값) [공식 대조 — 위 파일 상단 주석 참고]
  it("A1: 시급 10,320원, 주 40시간 → 월 환산 시간 208.57시간, 환산 월급 2,152,442원(경계, 이상)", () => {
    const result = hourly({ hourlyWage: 10_320, weeklyHours: 40 });

    expect(result.weeklyHolidayHours).toBeCloseTo(8, 10);
    expect(result.weeklyPaidHours).toBeCloseTo(48, 10);
    expect(result.monthlyEquivalentHours).toBe(208.57);
    expect(result.convertedMonthlyPay).toBe(2_152_442);
    expect(result.displayHourlyWage).toBe(10_320);
    expect(result.displayMonthlyPay).toBe(2_152_442);
    expect(result.minWageHourly).toBe(10_320);
    expect(result.minWageMonthlyEquivalent).toBe(2_152_442);
    expect(result.hourlyMeetsMinimumWage).toBe(true);
    expect(result.monthlyMeetsMinimumWage).toBe(true);
    expect(result.minimumWageJudgmentMismatch).toBe(false);
    expect(result.appliedRateYear).toBe(APPLICABLE_RATE_YEAR);
    expect(result.cappedAtStatutoryLimit).toBe(false);
  });

  it("A2: 시급 12,000원, 주 40시간 → 환산 월급 2,502,840원(최저임금보다 높음)", () => {
    const result = hourly({ hourlyWage: 12_000, weeklyHours: 40 });
    expect(result.convertedMonthlyPay).toBe(2_502_840);
    expect(result.hourlyMeetsMinimumWage).toBe(true);
    expect(result.monthlyMeetsMinimumWage).toBe(true);
    expect(result.minimumWageJudgmentMismatch).toBe(false);
  });

  it("A3: 시급 9,500원, 주 40시간 → 환산 월급 1,981,415원(최저임금보다 낮음)", () => {
    const result = hourly({ hourlyWage: 9_500, weeklyHours: 40 });
    expect(result.convertedMonthlyPay).toBe(1_981_415);
    expect(result.hourlyMeetsMinimumWage).toBe(false); // 9,500 < 10,320
    expect(result.monthlyMeetsMinimumWage).toBe(false); // 1,981,415 < 2,152,442
    expect(result.minimumWageJudgmentMismatch).toBe(false);
  });
});

describe("calculateFromMonthlyWage — 월급 모드 대칭 3가지 경계 + 신규 반례 (FORMULA.md v2 B1~B4)", () => {
  // 예제 B1 — A1과 교차검증 쌍(SPEC 완료 기준: 시급→월급→시급 왕복이 정확히 일치)
  it("B1: 월급 2,152,442원, 주 40시간 → 환산 시급 10,320원(경계, 이상) — A1과 교차검증", () => {
    const result = monthly({ monthlyWage: 2_152_442, weeklyHours: 40 });
    expect(result.monthlyEquivalentHours).toBe(208.57);
    expect(result.convertedHourlyWage).toBe(10_320); // round(10,319.998...) = 10,320
    expect(result.hourlyMeetsMinimumWage).toBe(true);
    expect(result.monthlyMeetsMinimumWage).toBe(true);
    expect(result.minimumWageJudgmentMismatch).toBe(false);
  });

  it("A1↔B1 교차검증: 시급→월급→시급 왕복이 정확히 원래 값으로 복원된다(monthlyEquivalentHours가 소수여도 유지됨)", () => {
    const a1 = hourly({ hourlyWage: 10_320, weeklyHours: 40 });
    const roundTrip = monthly({ monthlyWage: a1.convertedMonthlyPay, weeklyHours: 40 });
    expect(roundTrip.convertedHourlyWage).toBe(10_320); // = a1의 원본 입력 hourlyWage
  });

  it("B2: 월급 2,500,000원, 주 40시간 → 환산 시급 11,986원(반올림, 최저임금보다 높음)", () => {
    const result = monthly({ monthlyWage: 2_500_000, weeklyHours: 40 });
    expect(result.convertedHourlyWage).toBe(11_986); // round(2,500,000/208.57)=round(11,986.38...)
    expect(result.hourlyMeetsMinimumWage).toBe(true);
    expect(result.monthlyMeetsMinimumWage).toBe(true);
    expect(result.minimumWageJudgmentMismatch).toBe(false);
  });

  it("B3: 월급 2,000,000원, 주 40시간 → 환산 시급 9,589원(최저임금보다 낮음)", () => {
    const result = monthly({ monthlyWage: 2_000_000, weeklyHours: 40 });
    expect(result.convertedHourlyWage).toBe(9_589); // round(2,000,000/208.57)=round(9,589.11...)
    expect(result.hourlyMeetsMinimumWage).toBe(false); // 9,589 < 10,320
    expect(result.monthlyMeetsMinimumWage).toBe(false); // 2,000,000 < 2,152,442
    expect(result.minimumWageJudgmentMismatch).toBe(false);
  });

  // 예제 B4 — [신규, v2] Calculation Auditor 반례의 해소 검증. v1(정수 209시간)에서는
  // minWageMonthlyEquivalent=10,320×209=2,156,880원이라 2,154,000<2,156,880 → "위반"으로
  // 오판했으나, moel.go.kr 실제 판정 도구는 같은 입력에서 resultValue≈10,327.47원으로
  // "정상"이라고 판정한다(EVALUATION.md "우선순위 항목 2"). v2 정책이 이 반증을 실제로
  // 해소하는지 확인한다.
  it("B4: 월급 2,154,000원, 주 40시간 → 환산 시급 10,327원, moel.go.kr과 일치하는 '정상' 판정(v1의 '위반' 오판 해소)", () => {
    const result = monthly({ monthlyWage: 2_154_000, weeklyHours: 40 });
    expect(result.monthlyEquivalentHours).toBe(208.57);
    expect(result.convertedHourlyWage).toBe(10_327); // round(2,154,000/208.57)=round(10,327.47...)
    expect(result.hourlyMeetsMinimumWage).toBe(true); // 10,327 >= 10,320
    expect(result.monthlyMeetsMinimumWage).toBe(true); // 2,154,000 >= 2,152,442
    expect(result.minimumWageJudgmentMismatch).toBe(false);

    // v1 정책(정수 209시간 반올림)이었다면 이 입력이 "위반"으로 오판됐을 것임을 함께 남긴다
    // (회귀 방지 — 이 값이 다시 "미만"으로 뒤집히면 v1 버그가 재발한 것이다).
    const v1StyleThreshold = 10_320 * 209;
    expect(2_154_000).toBeLessThan(v1StyleThreshold); // v1 기준이었다면 "미만"(오판)
    expect(2_154_000).toBeGreaterThanOrEqual(result.minWageMonthlyEquivalent); // v2 기준은 "이상"(정상)
  });
});

describe("주 근무시간을 기본값(40)이 아닌 값으로 입력 — 비례 검증 (FORMULA.md v2 C1~C2)", () => {
  // 회귀 방지: minWageMonthlyEquivalent가 40시간 고정 208.57/2,152,442원이 아니라 실제
  // weeklyHours로 매번 재계산되는지 검증한다(ARCHITECTURE.md "7." 하드코딩 방지 요구사항).
  it("C1: 주 20시간, 시급 10,320원 → 월 환산 시간 104.29시간, 월 환산 최저임금 1,076,273원(40시간 값 아님)", () => {
    const result = hourly({ hourlyWage: 10_320, weeklyHours: 20 });
    expect(result.weeklyHolidayHours).toBeCloseTo(4, 10);
    expect(result.weeklyPaidHours).toBeCloseTo(24, 10);
    expect(result.monthlyEquivalentHours).toBe(104.29);
    expect(result.convertedMonthlyPay).toBe(1_076_273);
    expect(result.minWageMonthlyEquivalent).toBe(1_076_273); // ≠ 2,152,442(40시간 고정값)
    expect(result.hourlyMeetsMinimumWage).toBe(true);
    expect(result.monthlyMeetsMinimumWage).toBe(true);
  });

  it("C2: 주 30시간, 월급 1,700,000원 → 월 환산 시간 156.43시간, 환산 시급 10,867원, 월 환산 최저임금 1,614,358원", () => {
    const result = monthly({ monthlyWage: 1_700_000, weeklyHours: 30 });
    expect(result.weeklyHolidayHours).toBeCloseTo(6, 10);
    expect(result.weeklyPaidHours).toBeCloseTo(36, 10);
    expect(result.monthlyEquivalentHours).toBe(156.43);
    expect(result.convertedHourlyWage).toBe(10_867);
    expect(result.minWageMonthlyEquivalent).toBe(1_614_358); // ≠ 2,152,442 · ≠ C1의 1,076,273
    expect(result.hourlyMeetsMinimumWage).toBe(true); // 10,867 >= 10,320
    expect(result.monthlyMeetsMinimumWage).toBe(true); // 1,700,000 >= 1,614,358
  });

  it("C1·C2·A1의 minWageMonthlyEquivalent가 서로 다른 weeklyHours에 비례해 모두 다르다(하드코딩이면 셋 다 2,152,442원이 되어 이 테스트가 실패한다)", () => {
    const c1 = hourly({ hourlyWage: 10_320, weeklyHours: 20 });
    const c2 = monthly({ monthlyWage: 1_700_000, weeklyHours: 30 });
    const a1 = hourly({ hourlyWage: 10_320, weeklyHours: 40 });
    const values = [c1.minWageMonthlyEquivalent, c2.minWageMonthlyEquivalent, a1.minWageMonthlyEquivalent];
    expect(new Set(values).size).toBe(3);
    expect(values).toEqual([1_076_273, 1_614_358, 2_152_442]);
  });
});

describe("주 근무시간 경계값 (FORMULA.md v2 D1~D2)", () => {
  it("D1: 주 근무시간 최솟값 근접(1시간), 시급 10,320원 → 월 환산 시간 5.21시간, 환산 월급 53,767원", () => {
    const result = hourly({ hourlyWage: 10_320, weeklyHours: 1 });
    expect(result.weeklyHolidayHours).toBeCloseTo(0.2, 10);
    expect(result.weeklyPaidHours).toBeCloseTo(1.2, 10);
    expect(result.monthlyEquivalentHours).toBe(5.21);
    expect(result.convertedMonthlyPay).toBe(53_767);
    expect(result.minWageMonthlyEquivalent).toBe(53_767);
    expect(result.hourlyMeetsMinimumWage).toBe(true);
    expect(result.monthlyMeetsMinimumWage).toBe(true);
  });

  it("D2: 주 근무시간 상한(168시간), 시급 10,320원 → 주휴시간 8시간 상한 + 월 환산 시간 764.76시간, 환산 월급 7,892,323원", () => {
    const result = hourly({ hourlyWage: 10_320, weeklyHours: 168 });
    expect(result.weeklyHolidayHours).toBeCloseTo(8, 10); // min(33.6, 8) 상한 적용
    expect(result.cappedAtStatutoryLimit).toBe(true);
    expect(result.weeklyPaidHours).toBeCloseTo(176, 10);
    expect(result.monthlyEquivalentHours).toBe(764.76);
    expect(result.convertedMonthlyPay).toBe(7_892_323);
  });
});

describe("소수점 입력 (FORMULA.md v2 E1) — validation.ts를 거치지 않고 logic.ts를 직접 호출", () => {
  // ARCHITECTURE.md "10." — hourlyWage는 UI/validation 레벨에서는 정수만 허용하지만, 공식
  // 자체(반올림 로직)가 소수 입력에도 올바르게 동작하는지는 logic.ts를 직접 호출해 검증한다.
  it("E1: 시급 10,320.5원, 주 40시간 → round(10,320.5 × 208.57) = 2,152,547원(사사오입)", () => {
    const result = hourly({ hourlyWage: 10_320.5, weeklyHours: 40 });
    expect(result.convertedMonthlyPay).toBe(2_152_547);
  });
});

describe("calculateMonthlyEquivalentHoursExact — 반올림 전 정밀값(raw) 검증 (v1·v2 공통, 변경 없음)", () => {
  it("주 40시간: weeklyPaidHours=48 → 48×365/84 = 208.571428... (반올림 전)", () => {
    const rates = getApplicableRates();
    expect(
      calculateMonthlyEquivalentHoursExact(48, rates.laborStandards.monthlyWeekFactor.value),
    ).toBeCloseTo(208.571_428_571_428_57, 10);
  });

  it("주 20시간: weeklyPaidHours=24 → 24×365/84 = 104.285714...(반올림 전)", () => {
    const rates = getApplicableRates();
    expect(
      calculateMonthlyEquivalentHoursExact(24, rates.laborStandards.monthlyWeekFactor.value),
    ).toBeCloseTo(104.285_714_285_714_29, 10);
  });

  it("[v2] calculateMonthlyEquivalentHours는 이 정밀값을 소수 둘째 자리로 사사오입한 값을 반환한다(더 이상 정수가 아니다)", () => {
    const rates = getApplicableRates();
    expect(calculateMonthlyEquivalentHours(48, rates.laborStandards.monthlyWeekFactor.value)).toBe(
      208.57,
    );
  });
});

describe("[v2] weeklyHours가 매우 작을 때 monthlyEquivalentHours가 0으로 무너지는 현상 — 붕괴 임계값이 v1보다 훨씬 낮아졌다 (ARCHITECTURE.md 'v2 개정 > 6.')", () => {
  it("weeklyHours=0.05(v1에서는 0으로 붕괴했던 값)는 v2(소수 둘째 자리 반올림)에서는 더 이상 0으로 붕괴하지 않는다", () => {
    const { weeklyPaidHours } = calculateWeeklyPaidHours(0.05, 40, 8);
    const rates = getApplicableRates();
    const monthlyEquivalentHours = calculateMonthlyEquivalentHours(
      weeklyPaidHours,
      rates.laborStandards.monthlyWeekFactor.value,
    );
    // v1(정수 반올림)이었다면 Math.round(0.26...)=0으로 붕괴했겠지만, v2(round2)는 0.26을
    // 그대로 반환한다 — v2가 이 극단 구간에서 v1보다 더 안전하다는 것을 재확인한다.
    expect(monthlyEquivalentHours).toBe(0.26);
    expect(monthlyEquivalentHours).toBeGreaterThan(0);
  });

  it("weeklyHours=0.0005(v2 붕괴 임계값 약 0.00096보다 작은 값, 검증을 우회해 직접 계산)는 v2에서도 여전히 0으로 붕괴한다", () => {
    const { weeklyPaidHours } = calculateWeeklyPaidHours(0.0005, 40, 8);
    const rates = getApplicableRates();
    const monthlyEquivalentHours = calculateMonthlyEquivalentHours(
      weeklyPaidHours,
      rates.laborStandards.monthlyWeekFactor.value,
    );
    expect(monthlyEquivalentHours).toBe(0); // v2 붕괴 재현(임계값이 낮아졌을 뿐 완전히 사라지지는 않음)
  });

  it("validation.ts의 MIN_WEEKLY_HOURS(1)는 v1·v2 양쪽 붕괴 구간 모두로부터 충분히 안전하다 — weeklyHours=1(D1)은 monthlyEquivalentHours=5.21(>0)", () => {
    expect(MIN_WEEKLY_HOURS).toBe(1);
    const result = hourly({ hourlyWage: 10_320, weeklyHours: MIN_WEEKLY_HOURS });
    expect(result.monthlyEquivalentHours).toBeGreaterThan(0);
    expect(result.monthlyEquivalentHours).toBe(5.21);
    // MONTHLY 모드에서도 0 나눗셈(Infinity)이 발생하지 않는지 함께 확인한다.
    const monthlyResult = monthly({ monthlyWage: 1_000_000, weeklyHours: MIN_WEEKLY_HOURS });
    expect(Number.isFinite(monthlyResult.convertedHourlyWage)).toBe(true);
  });
});

describe("체이닝 금지 — 판별 유니온 결과에 반대 방향 필드/원본 입력 필드명이 존재하지 않는다 (ARCHITECTURE.md '3.')", () => {
  it("HOURLY 모드 결과에는 convertedHourlyWage/hourlyWage/monthlyWage 필드가 없다", () => {
    const result = hourly({ hourlyWage: 10_320, weeklyHours: 40 });
    expect("convertedHourlyWage" in result).toBe(false);
    expect("hourlyWage" in result).toBe(false);
    expect("monthlyWage" in result).toBe(false);
  });

  it("MONTHLY 모드 결과에는 convertedMonthlyPay/hourlyWage/monthlyWage 필드가 없다", () => {
    const result = monthly({ monthlyWage: 2_152_442, weeklyHours: 40 });
    expect("convertedMonthlyPay" in result).toBe(false);
    expect("hourlyWage" in result).toBe(false);
    expect("monthlyWage" in result).toBe(false);
  });
});

describe("calculateMinimumWageComparison — 오케스트레이터가 mode로 올바르게 분기한다", () => {
  it("mode=HOURLY면 calculateFromHourlyWage와 동일한 결과를 낸다", () => {
    const viaOrchestrator = calculateMinimumWageComparison({
      mode: "HOURLY",
      hourlyWage: 10_320,
      weeklyHours: 40,
    });
    const direct = hourly({ hourlyWage: 10_320, weeklyHours: 40 });
    expect(viaOrchestrator).toEqual(direct);
  });

  it("mode=MONTHLY면 calculateFromMonthlyWage와 동일한 결과를 낸다", () => {
    const viaOrchestrator = calculateMinimumWageComparison({
      mode: "MONTHLY",
      monthlyWage: 2_152_442,
      weeklyHours: 40,
    });
    const direct = monthly({ monthlyWage: 2_152_442, weeklyHours: 40 });
    expect(viaOrchestrator).toEqual(direct);
  });
});

describe("Edge Case — 경계 연속성 및 극단 입력", () => {
  it("weeklyHours 정확히 40: cappedAtStatutoryLimit=false / 40.0001: true(경계 연속성)", () => {
    expect(hourly({ hourlyWage: 10_000, weeklyHours: 40 }).cappedAtStatutoryLimit).toBe(false);
    expect(hourly({ hourlyWage: 10_000, weeklyHours: 40.0001 }).cappedAtStatutoryLimit).toBe(true);
  });

  it("hourlyWage == 최저임금(10,320): hourlyMeetsMinimumWage=true / 10,319: false", () => {
    expect(hourly({ hourlyWage: 10_320, weeklyHours: 40 }).hourlyMeetsMinimumWage).toBe(true);
    expect(hourly({ hourlyWage: 10_319, weeklyHours: 40 }).hourlyMeetsMinimumWage).toBe(false);
  });

  it("상식적 상한 근접(시급 1,000,000원 × 168시간): 결과가 유한하고 안전 정수 범위 내", () => {
    const result = hourly({ hourlyWage: 1_000_000, weeklyHours: 168 });
    expect(Number.isSafeInteger(result.convertedMonthlyPay)).toBe(true);
  });

  it("상식적 상한 근접(월급 10억 원, weeklyHours=1 최소값): 결과가 유한하고 안전 정수 범위 내", () => {
    const result = monthly({ monthlyWage: 1_000_000_000, weeklyHours: 1 });
    expect(Number.isSafeInteger(result.convertedHourlyWage)).toBe(true);
    expect(Number.isFinite(result.convertedHourlyWage)).toBe(true);
  });

  it("APPLICABLE_RATE_YEAR가 결과의 appliedRateYear로 그대로 실려 나온다", () => {
    expect(hourly({ hourlyWage: 10_320, weeklyHours: 40 }).appliedRateYear).toBe(APPLICABLE_RATE_YEAR);
  });
});

describe("[v2 신규] minimumWageJudgmentMismatch — Calculation Auditor 항목 6 반례 재현 (MONTHLY 모드에서만 발생)", () => {
  it("HOURLY 모드는 수학적으로 항상 minimumWageJudgmentMismatch=false다(hourlyWage 정수 × monthlyEquivalentHours 공통값)", () => {
    const results = [
      hourly({ hourlyWage: 10_320, weeklyHours: 40 }),
      hourly({ hourlyWage: 9_500, weeklyHours: 40 }),
      hourly({ hourlyWage: 12_000, weeklyHours: 20 }),
    ];
    for (const result of results) {
      expect(result.minimumWageJudgmentMismatch).toBe(false);
    }
  });

  it("MONTHLY 모드에서 원 단위 반올림 손실로 두 판정이 실제로 갈리는 반례가 존재한다(FORMULA.md v2 '이중 배지 불일치' 절, 반례 구간 폭 약 M/2)", () => {
    // v2(monthlyEquivalentHours=208.57) 기준 반례 구간: monthlyWage ∈ [2,152,339, 2,152,441].
    // 예: 2,152,400원 → convertedHourlyWage = round(2,152,400/208.57) ≈ round(10,320.086...) = 10,320
    // → hourlyMeetsMinimumWage=true, 그런데 2,152,400 < minWageMonthlyEquivalent(2,152,442)
    // → monthlyMeetsMinimumWage=false.
    const result = monthly({ monthlyWage: 2_152_400, weeklyHours: 40 });
    expect(result.convertedHourlyWage).toBe(10_320);
    expect(result.hourlyMeetsMinimumWage).toBe(true);
    expect(result.monthlyMeetsMinimumWage).toBe(false);
    expect(result.minimumWageJudgmentMismatch).toBe(true);
  });

  it("반례 구간을 벗어난 값(2,152,442원, 정확히 경계)은 minimumWageJudgmentMismatch=false다", () => {
    const result = monthly({ monthlyWage: 2_152_442, weeklyHours: 40 });
    expect(result.minimumWageJudgmentMismatch).toBe(false);
  });
});
