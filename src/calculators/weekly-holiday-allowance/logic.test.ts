/**
 * 주휴수당 계산기 — Golden Test + Edge Case Test.
 *
 * tasks/weekly-holiday-allowance/FORMULA.md "검증 예제" 7개 + "예외" 절을 그대로 옮긴 것이다.
 * 각 테스트 주석에 FORMULA.md 원문 라벨(어느 예제인지, 외부 대조 여부, 확인일)을 남긴다
 * (docs/CALCULATOR_RULES.md "Golden Test" 규칙).
 *
 * **대조 현황(FORMULA.md "대조 방법 고지", 2026-09-04 Calculation Auditor 4절 반영)**: 온라인
 * 계산기 4개(노동OK `cal_v3.js` / 알바천국 인라인 JS / 생활계산기 calcava / 시프티 `.min.js`)의
 * 계산 스크립트 소스를 직접 추출·재현했다. 노동OK·알바천국·calcava는 `(주 근무시간 ÷ 40) × 8
 * × 시급` + 40시간 상한으로 이 계산기와 동일하고, 시프티만 40시간 상한 없이 `÷ 5 × 시급`을
 * 쓴다. 예제 1~4의 1주치 주휴수당(82,560 / 40,000 / 28,800 / 36,000원)은 4개 계산기 추출 로직
 * 재현값과 정확히 일치했다(정수로 떨어져 반올림 논란 없음). 최종 원 단위 처리는 알바천국·
 * calcava = 반올림 / 노동OK·시프티 = 절사로 2:2 갈리며, 이 계산기는 반올림을 채택했다 —
 * 아래 Expected의 월 환산·반올림 값은 그 정책(365/84, 원 단위 반올림) 산출값이다.
 *
 * 검증 규약(ARCHITECTURE.md "숫자 정밀도 전략"):
 * - 완전정밀도 중간값은 `toBeCloseTo(exact, 3)`.
 * - FORMULA "Expected"의 반올림된 원 값은 `roundWon(result.x)` 또는 `formatWon(result.x)`로 검증.
 *
 * 이 테스트가 "통과"한다고 Builder가 정확성을 최종 판정하는 것은 아니다 — 최종 판정은
 * Calculation Auditor의 몫이다(.claude/agents/builder.md).
 */

import { describe, expect, it } from "vitest";
import {
  APPLICABLE_RATE_YEAR,
  calculateWeeklyHolidayAllowance,
} from "./logic";
import { formatWon, roundWon } from "./formatting";
import type { WeeklyHolidayAllowanceInput } from "./types";

const calc = (input: WeeklyHolidayAllowanceInput) =>
  calculateWeeklyHolidayAllowance(input);

describe("calculateWeeklyHolidayAllowance — Golden Test (FORMULA.md 검증 예제)", () => {
  // ── 예제 1 — 주 40시간 풀타임, 2026년 최저임금 ──────────────────────────────────────────
  // 라벨(FORMULA.md): "외부 계산기 산정식 대조". 노동OK·알바천국·생활계산기(calcava)·시프티
  //   4개 계산기의 추출 로직 재현값 (40÷40)×8×10,320 = 82,560원과 정확히 일치(주 40시간은
  //   상한이 걸려 시프티도 8시간분으로 같은 값). 월 환산은 노동OK 페이지 문구 "주휴수당 ×
  //   4.345"·고용노동부 209시간 산출과 동일 계수. monthlyTotalPay는 최저임금 고시상 최저월급
  //   2,156,880원(209시간)과 4,423원 차이(FORMULA.md "월 환산 계수" 절 — 이 계산기는 365/84
  //   직접 곱셈 채택). Calculation Auditor 소스 추출 확인일 2026-09-04.
  it("예제 1: 주 40시간 풀타임, 2026년 최저임금 — 외부 계산기 산정식 대조", () => {
    const result = calc({ hourlyWage: 10_320, weeklyHours: 40 });

    expect(result.weeklyHolidayHours).toBeCloseTo(8, 10);
    // 핵심 결과 — 반올림 논란 거의 없음(정수로 떨어짐).
    expect(result.weeklyHolidayPay).toBeCloseTo(82_560, 3);
    expect(roundWon(result.weeklyHolidayPay)).toBe(82_560);
    // 완전정밀도 중간값(365/84 한 번에 계산): 82,560 × 365 ÷ 84 = 358,742.857142857...
    expect(result.monthlyHolidayPay).toBeCloseTo(358_742.857_142_857, 3);
    expect(roundWon(result.monthlyHolidayPay)).toBe(358_743);
    expect(roundWon(result.weeklyTotalPay)).toBe(495_360);
    expect(result.monthlyTotalPay).toBeCloseTo(2_152_457.142_857_143, 3);
    expect(roundWon(result.monthlyTotalPay)).toBe(2_152_457);
    expect(roundWon(result.effectiveHourlyWage)).toBe(12_384); // = 10,320 × 1.2

    expect(result.meetsMinHoursRequirement).toBe(true);
    expect(result.belowMinimumWage).toBe(false);
    expect(result.cappedAtStatutoryLimit).toBe(false);
    expect(result.appliedRateYear).toBe(2026);
    expect(result.minimumHourlyWage).toBe(10_320);
  });

  // ── 예제 2 — 주 20시간 파트타임, 시급 10,000원 ─────────────────────────────────────────
  // 라벨(FORMULA.md): "**행정해석 예시값 + 온라인 계산기 산정식(소스 확인) 대조로 1주치 주휴수당
  //   검증** (docs/CALCULATOR_RULES.md '공식/공신력 계산기 대조 최소 2개' 중 1개)."
  //   - 고용노동부 빠른인터넷상담 사례: 단시간근로자 주 20시간(시급 10,000원) → "1일 유급휴일수당
  //     40,000원"과 일치(확인일 2026-09-04).
  //   - 노동OK 산정식(cal_v3.js 소스 직접 확인): ÷ 통상소정일[기본 5] × 시급 = 20 ÷ 5 × 10,000
  //     = 40,000원. 현재 노동OK 페이지는 개편판이라 워크드 예시는 페이지 본문에 없으나 산정식은 동일.
  //   월 환산·반올림 값은 이 FORMULA.md 정책(365/84, 반올림) 산출값.
  it("예제 2: 주 20시간 파트타임, 시급 10,000원 — 공신력 있는 예시값과 1주치 직접 대조", () => {
    const result = calc({ hourlyWage: 10_000, weeklyHours: 20 });

    expect(result.weeklyHolidayHours).toBeCloseTo(4, 10);
    expect(result.weeklyHolidayPay).toBeCloseTo(40_000, 3); // 노동OK/고용노동부 예시와 일치
    expect(roundWon(result.weeklyHolidayPay)).toBe(40_000);
    expect(result.monthlyHolidayPay).toBeCloseTo(173_809.523_809_523, 3);
    expect(roundWon(result.monthlyHolidayPay)).toBe(173_810);
    expect(roundWon(result.weeklyTotalPay)).toBe(240_000);
    expect(roundWon(result.monthlyTotalPay)).toBe(1_042_857);
    expect(roundWon(result.effectiveHourlyWage)).toBe(12_000);

    expect(result.meetsMinHoursRequirement).toBe(true);
    expect(result.belowMinimumWage).toBe(true); // 10,000 < 10,320
    expect(result.cappedAtStatutoryLimit).toBe(false);
  });

  // ── 예제 3 — 주 16시간(주 2일 8시간), 시급 9,000원 ────────────────────────────────────
  // 라벨(FORMULA.md): "**독립 2차 출처(나무위키) 예시값과 1주치 주휴수당 대조** + 최저임금 미만
  //   경고 경로 검증." 나무위키 "주휴수당" 문서: "시급 9,000원, 주 2일·하루 8시간 →
  //   (16시간 ÷ 40) × 8시간 × 9,000원 = 28,800원"과 1주치 값 일치(확인일 2026-09-04).
  //   docs/CALCULATOR_RULES.md "공식/공신력 계산기 대조 최소 2개" 중 2번째(독립 2차 출처).
  it("예제 3: 주 16시간, 시급 9,000원 — 독립 2차 출처(나무위키) 예시값 대조 + 최저임금 경고", () => {
    const result = calc({ hourlyWage: 9_000, weeklyHours: 16 });

    expect(result.weeklyHolidayHours).toBeCloseTo(3.2, 10); // 반올림하지 않음
    expect(result.weeklyHolidayPay).toBeCloseTo(28_800, 3); // 나무위키 예시와 일치
    expect(roundWon(result.weeklyHolidayPay)).toBe(28_800);
    expect(result.monthlyHolidayPay).toBeCloseTo(125_142.857_142_857, 3);
    expect(roundWon(result.monthlyHolidayPay)).toBe(125_143);
    expect(roundWon(result.weeklyTotalPay)).toBe(172_800);
    expect(roundWon(result.monthlyTotalPay)).toBe(750_857);
    expect(roundWon(result.effectiveHourlyWage)).toBe(10_800); // = 9,000 × 1.2

    expect(result.meetsMinHoursRequirement).toBe(true);
    expect(result.belowMinimumWage).toBe(true); // 9,000 < 10,320 → 경고
  });

  // ── 예제 4 — 주 15시간 경계값 (정확히 15시간), 시급 12,000원 ──────────────────────────
  // 라벨(FORMULA.md): "공식 대조 아님(경계값 검증). 14.99시간이면 meetsMinHoursRequirement=false가
  //   되는지 함께 테스트." (아래 Edge Case describe에서 14.99/15/15.01 별도 검증)
  it("예제 4: 주 15시간 경계값 — 15시간 '이상'이면 경고 없음(공식 대조 아님)", () => {
    const result = calc({ hourlyWage: 12_000, weeklyHours: 15 });

    expect(result.weeklyHolidayHours).toBeCloseTo(3, 10);
    expect(roundWon(result.weeklyHolidayPay)).toBe(36_000);
    expect(result.monthlyHolidayPay).toBeCloseTo(156_428.571_428_571, 3);
    expect(roundWon(result.monthlyHolidayPay)).toBe(156_429);
    expect(roundWon(result.weeklyTotalPay)).toBe(216_000);
    expect(roundWon(result.monthlyTotalPay)).toBe(938_571);
    expect(roundWon(result.effectiveHourlyWage)).toBe(14_400); // = 12,000 × 1.2

    expect(result.meetsMinHoursRequirement).toBe(true); // 15 >= 15 → 경고 없음
    expect(result.belowMinimumWage).toBe(false);
  });

  // ── 예제 5 — 주 15시간 미만 (14시간), 시급 10,320원 — 경고 표시 + 계산 진행 ────────────
  // 라벨(FORMULA.md): "공식 대조 아님(게이팅 없이 계산 + 경고 노출 동작 검증, SPEC '설계상
  //   핵심 결정'). meetsMinHoursRequirement=false여도 아래 금액은 모두 계산·반환."
  //   monthlyHolidayPay·monthlyTotalPay는 나누어떨어진다.
  it("예제 5: 주 14시간(15시간 미만) — 게이팅 없이 계산 + 경고 플래그 노출", () => {
    const result = calc({ hourlyWage: 10_320, weeklyHours: 14 });

    expect(result.meetsMinHoursRequirement).toBe(false); // ← 경고
    // 그럼에도 금액은 모두 계산·반환:
    expect(result.weeklyHolidayHours).toBeCloseTo(2.8, 10);
    expect(roundWon(result.weeklyHolidayPay)).toBe(28_896);
    expect(roundWon(result.monthlyHolidayPay)).toBe(125_560); // 나누어떨어짐
    expect(roundWon(result.weeklyTotalPay)).toBe(173_376);
    expect(roundWon(result.monthlyTotalPay)).toBe(753_360); // 나누어떨어짐
    expect(roundWon(result.effectiveHourlyWage)).toBe(12_384);
    expect(result.belowMinimumWage).toBe(false); // 10,320 == 최저임금(미만 아님)
  });

  // ── 예제 6 — 주 40시간 초과 (48시간), 시급 15,000원 — 8시간 상한 검증 ────────────────
  // 라벨(FORMULA.md): "공식 대조 아님(40시간 상한 검증). 정확히 40시간이면 weeklyHolidayHours=8로
  //   동일함을 함께 테스트(경계 연속성)." weeklyTotalPay는 연장근로 가산 미반영(breakdown에 고지).
  it("예제 6: 주 48시간(40시간 초과) — 8시간 상한 적용 + cappedAtStatutoryLimit", () => {
    const result = calc({ hourlyWage: 15_000, weeklyHours: 48 });

    expect(result.weeklyHolidayHours).toBeCloseTo(8, 10); // min(9.6, 8) = 8
    expect(roundWon(result.weeklyHolidayPay)).toBe(120_000);
    expect(result.monthlyHolidayPay).toBeCloseTo(521_428.571_428_571, 3);
    expect(roundWon(result.monthlyHolidayPay)).toBe(521_429);
    expect(roundWon(result.weeklyTotalPay)).toBe(840_000); // 연장근로 가산 미반영
    expect(roundWon(result.monthlyTotalPay)).toBe(3_650_000); // 나누어떨어짐
    expect(roundWon(result.effectiveHourlyWage)).toBe(17_500);

    expect(result.meetsMinHoursRequirement).toBe(true);
    expect(result.cappedAtStatutoryLimit).toBe(true);
  });

  // ── 예제 7 — 소수점 시간 입력, 시급 11,000원, 주 13.5시간 ────────────────────────────
  // 라벨(FORMULA.md): "공식 대조 아님(소수점 입력 + 부동소수점 정합성 검증). 노동OK 페이지의
  //   '하루 5시간 × 3일, 매일 30분 휴게 → 실제 주 근로시간 13.5시간' 설명과 입력 시나리오가 정합."
  it("예제 7: 주 13.5시간(소수점 입력) — 소수 입력 + 부동소수점 정합성", () => {
    const result = calc({ hourlyWage: 11_000, weeklyHours: 13.5 });

    expect(result.meetsMinHoursRequirement).toBe(false); // 13.5 < 15 → 경고
    expect(result.weeklyHolidayHours).toBeCloseTo(2.7, 10);
    expect(result.weeklyHolidayPay).toBeCloseTo(29_700, 3);
    expect(roundWon(result.weeklyHolidayPay)).toBe(29_700);
    expect(result.monthlyHolidayPay).toBeCloseTo(129_053.571_428_571, 3);
    expect(roundWon(result.monthlyHolidayPay)).toBe(129_054);
    expect(roundWon(result.weeklyTotalPay)).toBe(178_200);
    expect(roundWon(result.monthlyTotalPay)).toBe(774_321);
    expect(roundWon(result.effectiveHourlyWage)).toBe(13_200); // = 11,000 × 1.2
  });

  // FORMULA.md 예제 표기(콤마 포함 "82,560원" 등)와 formatWon 출력이 일치하는지 확인.
  it("formatWon 표시 문자열이 FORMULA.md 예제 1 Expected와 일치한다", () => {
    const result = calc({ hourlyWage: 10_320, weeklyHours: 40 });
    expect(formatWon(result.weeklyHolidayPay)).toBe("82,560원");
    expect(formatWon(result.monthlyHolidayPay)).toBe("358,743원");
    expect(formatWon(result.weeklyTotalPay)).toBe("495,360원");
    expect(formatWon(result.monthlyTotalPay)).toBe("2,152,457원");
  });
});

describe("calculateWeeklyHolidayAllowance — Edge Case Test (FORMULA.md '예외')", () => {
  it("weeklyHours 정확히 40: weeklyHolidayHours=8, cappedAtStatutoryLimit=false (경계 연속성)", () => {
    const result = calc({ hourlyWage: 10_000, weeklyHours: 40 });
    expect(result.weeklyHolidayHours).toBeCloseTo(8, 10);
    expect(result.cappedAtStatutoryLimit).toBe(false);
  });

  it("weeklyHours 40 바로 위(40.0001): 8시간 상한 + cappedAtStatutoryLimit=true", () => {
    const result = calc({ hourlyWage: 10_000, weeklyHours: 40.0001 });
    expect(result.weeklyHolidayHours).toBeCloseTo(8, 10); // min(8.00002, 8) = 8
    expect(result.cappedAtStatutoryLimit).toBe(true);
  });

  it("15시간 경계 바로 아래/경계/바로 위: meetsMinHoursRequirement 판정", () => {
    expect(calc({ hourlyWage: 12_000, weeklyHours: 14.99 }).meetsMinHoursRequirement).toBe(false);
    expect(calc({ hourlyWage: 12_000, weeklyHours: 15 }).meetsMinHoursRequirement).toBe(true);
    expect(calc({ hourlyWage: 12_000, weeklyHours: 15.01 }).meetsMinHoursRequirement).toBe(true);
  });

  it("hourlyWage == 최저임금(10,320): belowMinimumWage=false / 10,319: true", () => {
    expect(calc({ hourlyWage: 10_320, weeklyHours: 40 }).belowMinimumWage).toBe(false);
    expect(calc({ hourlyWage: 10_319, weeklyHours: 40 }).belowMinimumWage).toBe(true);
  });

  it("MAX_HOURLY_WAGE + MAX_WEEKLY_HOURS 극단 입력: 결과가 유한하고 안전 정수 범위 내", () => {
    const result = calc({ hourlyWage: 1_000_000, weeklyHours: 168 });
    for (const value of [
      result.weeklyHolidayPay,
      result.monthlyHolidayPay,
      result.weeklyTotalPay,
      result.monthlyTotalPay,
      result.effectiveHourlyWage,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isSafeInteger(roundWon(value))).toBe(true);
    }
    expect(result.weeklyHolidayHours).toBeCloseTo(8, 10); // 168 > 40 → 상한
    expect(result.cappedAtStatutoryLimit).toBe(true);
  });

  it("weeklyHolidayHours는 반올림하지 않고 소수 그대로 반환한다 (23/5=4.6, 13.5/5=2.7)", () => {
    expect(calc({ hourlyWage: 10_000, weeklyHours: 23 }).weeklyHolidayHours).toBeCloseTo(4.6, 10);
    expect(calc({ hourlyWage: 10_000, weeklyHours: 13.5 }).weeklyHolidayHours).toBeCloseTo(2.7, 10);
    expect(calc({ hourlyWage: 10_000, weeklyHours: 37 }).weeklyHolidayHours).toBeCloseTo(7.4, 10);
  });

  it("APPLICABLE_RATE_YEAR가 결과의 appliedRateYear로 그대로 실려 나온다", () => {
    const result = calc({ hourlyWage: 10_320, weeklyHours: 40 });
    expect(result.appliedRateYear).toBe(APPLICABLE_RATE_YEAR);
  });
});

describe("roundWon — 표시 직전 반올림 정책 (FORMULA.md '정밀도/반올림 정책')", () => {
  // 정책: round half up(사사오입). 절사/올림으로 바뀌면 formatting.ts의 roundWon 본문만 고친다
  // (Calculation Auditor 대조 지점).
  it("사사오입: 358,742.857 → 358,743 / 173,809.523 → 173,810", () => {
    expect(roundWon(358_742.857_142_857)).toBe(358_743);
    expect(roundWon(173_809.523_809_523)).toBe(173_810);
  });

  it("나누어떨어지는 값은 항등: 125,560 → 125,560", () => {
    expect(roundWon(125_560)).toBe(125_560);
    expect(roundWon(753_360)).toBe(753_360);
  });

  it("부동소수점 오차가 있는 정수(예: 125559.9999999)를 올바르게 반올림한다", () => {
    expect(roundWon(125_559.999_999_9)).toBe(125_560);
    expect(roundWon(125_560.000_000_1)).toBe(125_560);
    // 수학적으로 x.5인 값이 부동소수점 표현으로 x.4999999처럼 계산돼도 EPSILON 보정으로 올림된다.
    expect(roundWon(1.499_999_999)).toBe(2);
  });
});
