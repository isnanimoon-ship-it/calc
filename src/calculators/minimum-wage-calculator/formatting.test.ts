/**
 * 최저임금·시급↔월급 계산기 — 표시용 포맷팅 + 계산 근거(breakdown) 빌더 테스트.
 *
 * [v2 재구현, 2026-09-14] FORMULA.md v2(소수 둘째 자리 반올림 정책)에 맞춰 breakdown
 * 문자열의 기댓값(예: "209시간" → "208.57시간", "2,156,880원" → "2,152,442원")을 전부
 * 교체했다. `buildJudgmentMismatchNotice` 신규 테스트를 추가했다(ARCHITECTURE.md "v2 개정
 * > 4." Builder 구현 지침).
 */

import { describe, expect, it } from "vitest";
import { calculateFromHourlyWage, calculateFromMonthlyWage } from "./logic";
import {
  buildBelowMinimumWageWarning,
  buildJudgmentMismatchNotice,
  buildMinimumWageBreakdown,
  formatHours,
  formatWon,
} from "./formatting";

describe("formatWon", () => {
  it("정수 금액을 천 단위 콤마 + '원'으로 표시한다", () => {
    expect(formatWon(2_152_442)).toBe("2,152,442원");
    expect(formatWon(0)).toBe("0원");
  });
});

describe("formatHours", () => {
  it("소수 2자리까지 표시하고 '시간'을 붙인다", () => {
    expect(formatHours(8)).toBe("8시간");
    expect(formatHours(4.6)).toBe("4.6시간");
    expect(formatHours(2.75)).toBe("2.75시간");
  });

  it("소수 2자리를 넘는 값은 반올림해 자른다(금액이 아니라 표시 전용)", () => {
    expect(formatHours(208.571_428_571)).toBe("208.57시간");
    expect(formatHours(104.285_714_285)).toBe("104.29시간");
  });

  it("[v2] logic.ts가 이미 소수 둘째 자리로 반올림해 반환한 monthlyEquivalentHours 값도 그대로 자연스럽게 표시한다", () => {
    expect(formatHours(208.57)).toBe("208.57시간");
    expect(formatHours(5.21)).toBe("5.21시간");
    // 우연히 정수로 딱 떨어지는 경우(예: weeklyPaidHours=84의 배수)에도 "365.00시간"처럼
    // 불필요한 후행 0을 붙이지 않는다.
    expect(formatHours(365)).toBe("365시간");
  });
});

describe("buildMinimumWageBreakdown — FORMULA.md v2 예제 A1", () => {
  it("HOURLY 모드는 '환산 월급' 행을 포함하고 5단계의 계산 근거를 반환한다", () => {
    const result = calculateFromHourlyWage({ mode: "HOURLY", hourlyWage: 10_320, weeklyHours: 40 });
    const rows = buildMinimumWageBreakdown(result);
    const labels = rows.map((row) => row.label);
    expect(labels).toEqual(["1주 주휴시간", "월 환산 시간", "환산 월급", "시급 비교", "월급 비교"]);

    const monthlyEquivalentRow = rows.find((row) => row.label === "월 환산 시간");
    expect(monthlyEquivalentRow?.expression).toContain("208.57시간");
    expect(monthlyEquivalentRow?.expression).not.toContain("209시간");

    const monthlyPayRow = rows.find((row) => row.label === "환산 월급");
    expect(monthlyPayRow?.expression).toContain("10,320원");
    expect(monthlyPayRow?.expression).toContain("208.57시간");
    expect(monthlyPayRow?.expression).toContain("2,152,442원");
  });
});

describe("buildMinimumWageBreakdown — FORMULA.md v2 예제 B2(월급 모드)", () => {
  it("MONTHLY 모드는 '환산 시급' 행을 포함한다", () => {
    const result = calculateFromMonthlyWage({
      mode: "MONTHLY",
      monthlyWage: 2_500_000,
      weeklyHours: 40,
    });
    const rows = buildMinimumWageBreakdown(result);
    const hourlyWageRow = rows.find((row) => row.label === "환산 시급");
    expect(hourlyWageRow?.expression).toContain("2,500,000원");
    expect(hourlyWageRow?.expression).toContain("208.57시간");
    expect(hourlyWageRow?.expression).toContain("11,986원");
  });
});

describe("buildBelowMinimumWageWarning — 게이팅 없이 항상 계산, 경고 문구만 조건부", () => {
  it("최저임금 이상이면 경고가 없다(null)", () => {
    const result = calculateFromHourlyWage({ mode: "HOURLY", hourlyWage: 12_000, weeklyHours: 40 });
    expect(buildBelowMinimumWageWarning(result)).toBeNull();
  });

  it("시급·월급 모두 미달이면 두 문구를 함께 담는다(A3 예제)", () => {
    const result = calculateFromHourlyWage({ mode: "HOURLY", hourlyWage: 9_500, weeklyHours: 40 });
    const warning = buildBelowMinimumWageWarning(result);
    expect(warning).not.toBeNull();
    expect(warning).toContain("시급");
    expect(warning).toContain("월급");
  });

  it("월급만 최저임금 미만이면 월급 문구만 담는다", () => {
    // 시급 자체는 최저임금 이상이지만 극단적으로 짧은 근무시간 때문에 월 환산액이 낮게 나오는
    // 상황은 이 계산기 산식상 HOURLY 모드에서는 발생하지 않는다(시급이 같으면 월 환산액도
    // 같은 비율로 비례) — 대신 B3(월급 모드, 시급·월급 둘 다 미달)과 B1(둘 다 충족)만으로
    // 충분히 검증된다는 점을 문서화한다. 이 테스트는 HOURLY 모드에서
    // "hourlyMeetsMinimumWage=true인데 monthlyMeetsMinimumWage=false"인 조합이 나타나지
    // 않음을 재확인하는 방어적 회귀 테스트다(MONTHLY 모드에서는 나타날 수 있다 — 아래
    // "minimumWageJudgmentMismatch" 테스트 참고).
    const result = calculateFromHourlyWage({ mode: "HOURLY", hourlyWage: 10_320, weeklyHours: 40 });
    expect(result.hourlyMeetsMinimumWage).toBe(result.monthlyMeetsMinimumWage);
  });
});

describe("[v2 신규] buildJudgmentMismatchNotice — minimumWageJudgmentMismatch 조건부 안내 문구", () => {
  it("두 판정이 같으면 null을 반환한다(A1 예제, 경계에서도 일치)", () => {
    const result = calculateFromHourlyWage({ mode: "HOURLY", hourlyWage: 10_320, weeklyHours: 40 });
    expect(result.minimumWageJudgmentMismatch).toBe(false);
    expect(buildJudgmentMismatchNotice(result)).toBeNull();
  });

  it("MONTHLY 모드에서 두 판정이 갈리면(반올림 손실 반례) 설명 문구를 반환한다", () => {
    const result = calculateFromMonthlyWage({
      mode: "MONTHLY",
      monthlyWage: 2_152_400,
      weeklyHours: 40,
    });
    expect(result.minimumWageJudgmentMismatch).toBe(true);
    const notice = buildJudgmentMismatchNotice(result);
    expect(notice).not.toBeNull();
    expect(notice).toContain("반올림");
  });
});
