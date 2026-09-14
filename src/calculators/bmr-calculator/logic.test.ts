/**
 * 기초대사량(BMR) 계산기 — Golden Test.
 *
 * tasks/bmr-calculator/FORMULA.md "검증 예제" 25개 그룹을 tasks/bmr-calculator/
 * ARCHITECTURE.md "8. Golden Test 배치 전략"이 정한 대로 logic.test.ts(대부분)와
 * validation.test.ts(입력 검증 실패 케이스, #10·#12·#15·#23~24)로 나눠 배치한다.
 *
 * docs/CALCULATOR_RULES.md "Golden Test — 공식 계산기 예시값과 대조한 케이스 최소 2개"는
 * 아래 #20~#21(Inch Calculator 대조)로 충족한다.
 *
 * **이 테스트가 "통과"한다고 해서 Builder가 계산기의 정확성을 최종 판정하는 것은 아니다** —
 * 최종 판정은 Calculation Auditor의 몫이다(.claude/agents/builder.md).
 */

import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FACTORS,
  calculateAllTdeeLevels,
  calculateBmr,
  calculateBmrAlternative,
  calculateBmrCalculation,
  calculateTdee,
  isValidActivityLevel,
} from "./logic";
import type { ActivityLevel, BmrCalculationInput, BodyMetrics } from "./types";

function metrics(overrides: Partial<BodyMetrics> = {}): BodyMetrics {
  return { sex: "male", ageYears: 30, heightCm: 175, weightKg: 70, ...overrides };
}

function input(overrides: Partial<BmrCalculationInput> = {}): BmrCalculationInput {
  return { ...metrics(), activityLevel: null, ...overrides };
}

describe(
  "calculateBmr — 대표 공식(Mifflin-St Jeor) 정상값·성별대조·경계값 (Golden Test #1~2, #9, #11, #13~14, #16, #20~22)",
  () => {
    it("#1: Male 30/175cm/70kg — raw 1648.75 → 표시 1649", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 30, heightCm: 175, weightKg: 70 }));
      expect(bmr.raw).toBe(1648.75);
      expect(bmr.display).toBe(1649);
    });

    it("#2: Female 30/165cm/60kg — raw 1320.25 → 표시 1320", () => {
      const bmr = calculateBmr(metrics({ sex: "female", ageYears: 30, heightCm: 165, weightKg: 60 }));
      expect(bmr.raw).toBe(1320.25);
      expect(bmr.display).toBe(1320);
    });

    it("#9: Male 19/175cm/70kg — 나이 하한 경계(19세) 자체는 유효, raw 1703.75 → 표시 1704", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 19, heightCm: 175, weightKg: 70 }));
      expect(bmr.raw).toBe(1703.75);
      expect(bmr.display).toBe(1704);
    });

    it("#11: Female 78/160cm/60kg — 나이 상한 경계(78세) 자체는 유효, raw 1049.0 → 표시 1049", () => {
      const bmr = calculateBmr(metrics({ sex: "female", ageYears: 78, heightCm: 160, weightKg: 60 }));
      expect(bmr.raw).toBe(1049);
      expect(bmr.display).toBe(1049);
    });

    it("#13: Male 19/100.0cm/30kg — 키 하한 경계(100.0cm) 자체는 유효, raw 835.0 → 표시 835", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 19, heightCm: 100.0, weightKg: 30 }));
      expect(bmr.raw).toBe(835);
      expect(bmr.display).toBe(835);
    });

    it("#14: Female 78/230.0cm/300.0kg — 키·체중 상한 경계 자체는 유효, raw 3886.5 → 표시 3887", () => {
      const bmr = calculateBmr(
        metrics({ sex: "female", ageYears: 78, heightCm: 230.0, weightKg: 300.0 }),
      );
      expect(bmr.raw).toBe(3886.5);
      expect(bmr.display).toBe(3887);
    });

    it("#16: 성별 상수 차이 — 나이·키·체중 동일(40/170cm/65kg), 성별만 다름 → 차이는 정확히 166kcal", () => {
      const male = calculateBmr(metrics({ sex: "male", ageYears: 40, heightCm: 170, weightKg: 65 }));
      const female = calculateBmr(metrics({ sex: "female", ageYears: 40, heightCm: 170, weightKg: 65 }));
      expect(male.raw).toBe(1517.5);
      expect(male.display).toBe(1518);
      expect(female.raw).toBe(1351.5);
      expect(female.display).toBe(1352);
      // 성별 상수 차 = +5 − (−161) = 166.
      expect(male.raw - female.raw).toBe(166);
    });

    // ── 외부 계산기 대조 1/2 (docs/CALCULATOR_RULES.md "Golden Test" 최소 2개 요건) ──
    it("#20: 외부 계산기 대조 1 — Female 35/165.1cm/54.55kg, Inch Calculator(확인일 2026-09-13) 결과 1,241kcal과 일치", () => {
      const bmr = calculateBmr(metrics({ sex: "female", ageYears: 35, heightCm: 165.1, weightKg: 54.55 }));
      expect(bmr.raw).toBeCloseTo(1241.375, 10);
      expect(bmr.display).toBe(1241);
    });

    it("#21: 외부 계산기 대조 2 — Male 60/162.56cm/68.04kg, Omni Calculator(확인일 2026-09-13) 결과 1,401.4kcal/day와 일치", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 60, heightCm: 162.56, weightKg: 68.04 }));
      expect(bmr.raw).toBeCloseTo(1401.4, 10);
      expect(bmr.display).toBe(1401);
    });

    it("#22: 소수 입력 처리 — Male 33/174.5cm/68.3kg(이진 소수 비정확 표현 케이스) — raw 1613.625 → 표시 1614", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 33, heightCm: 174.5, weightKg: 68.3 }));
      expect(bmr.raw).toBeCloseTo(1613.625, 10);
      expect(bmr.display).toBe(1614);
    });

    it("완료 기준 불변식(b): 같은 성별·키·체중에서 나이가 1씩 증가하면 raw가 항상 정확히 5kcal씩 감소한다(나이 계수가 선형)", () => {
      const younger = calculateBmr(metrics({ ageYears: 40 }));
      const older = calculateBmr(metrics({ ageYears: 41 }));
      expect(younger.raw - older.raw).toBe(5);
    });
  },
);

describe("calculateBmrAlternative — 보조 공식(Harris-Benedict 개정판, Should Have) (Golden Test #18~19)", () => {
  it("#18: Male 45/180cm/85kg(대표 공식 #3과 동일 인물) — raw 1835.462 → 표시 1835, 대표 공식(1755)과 다른 값", () => {
    const bmrAlternative = calculateBmrAlternative(
      metrics({ sex: "male", ageYears: 45, heightCm: 180, weightKg: 85 }),
    );
    expect(bmrAlternative.raw).toBeCloseTo(1835.462, 6);
    expect(bmrAlternative.display).toBe(1835);
    // 대표 공식과 값이 다름을 함께 확인 — 두 계산이 서로 독립임을 값으로도 보인다.
    const bmrRepresentative = calculateBmr(
      metrics({ sex: "male", ageYears: 45, heightCm: 180, weightKg: 85 }),
    );
    expect(bmrRepresentative.display).toBe(1755);
    expect(bmrAlternative.display).not.toBe(bmrRepresentative.display);
  });

  it("#19: Female 45/160cm/55kg(대표 공식 #4와 동일 인물) — raw 1257.008 → 표시 1257", () => {
    const bmrAlternative = calculateBmrAlternative(
      metrics({ sex: "female", ageYears: 45, heightCm: 160, weightKg: 55 }),
    );
    expect(bmrAlternative.raw).toBeCloseTo(1257.008, 6);
    expect(bmrAlternative.display).toBe(1257);
  });

  it("이 describe 블록은 calculateBmr을 호출하지 않고도 독립적으로 검증 가능하다(완전히 독립된 계산이라는 설계 증명)", () => {
    // 위 두 테스트가 이미 calculateBmrAlternative만으로 값을 검증했다 — 이 테스트는 그
    // 사실 자체를 명시적으로 표시하는 목적의 문서용 assertion이다.
    const result = calculateBmrAlternative(metrics({ sex: "male" }));
    expect(typeof result.raw).toBe("number");
  });
});

describe(
  "calculateTdee — 활동계수 적용 및 반올림 정책 핵심 불변식 (Golden Test #3~7, #17, #20 재검증)",
  () => {
    it("#3: Male 45/180cm/85kg, 활동량=보통(1.55) — BMR raw 1755.0 → 표시 1755, TDEE raw 2720.25 → 표시 2720", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 45, heightCm: 180, weightKg: 85 }));
      expect(bmr.display).toBe(1755);
      const tdee = calculateTdee(bmr.raw, 3);
      expect(tdee.raw).toBe(2720.25);
      expect(tdee.display).toBe(2720);
      expect(tdee.activityFactor).toBe(1.55);
    });

    it("#4: Female 45/160cm/55kg, 활동량=거의 안 함(1.2) — BMR raw 1164.0 → 표시 1164, TDEE raw 1396.8 → 표시 1397", () => {
      const bmr = calculateBmr(metrics({ sex: "female", ageYears: 45, heightCm: 160, weightKg: 55 }));
      expect(bmr.display).toBe(1164);
      const tdee = calculateTdee(bmr.raw, 1);
      expect(tdee.raw).toBeCloseTo(1396.8, 10);
      expect(tdee.display).toBe(1397);
    });

    it("#5: Male 25/170cm/65kg, 활동량=가벼운 활동(1.375) — BMR raw 1592.5 → 표시 1593, TDEE raw 2189.6875 → 표시 2190", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 25, heightCm: 170, weightKg: 65 }));
      expect(bmr.display).toBe(1593);
      const tdee = calculateTdee(bmr.raw, 2);
      expect(tdee.raw).toBe(2189.6875);
      expect(tdee.display).toBe(2190);
    });

    it("#6: Female 25/158cm/50kg, 활동량=활발한 활동(1.725) — BMR raw 1201.5 → 표시 1202, TDEE raw 2072.5875 → 표시 2073", () => {
      const bmr = calculateBmr(metrics({ sex: "female", ageYears: 25, heightCm: 158, weightKg: 50 }));
      expect(bmr.display).toBe(1202);
      const tdee = calculateTdee(bmr.raw, 4);
      expect(tdee.raw).toBeCloseTo(2072.5875, 10);
      expect(tdee.display).toBe(2073);
    });

    it("#7: Male 50/178cm/90kg, 활동량=매우 활발함(1.9) — BMR raw 1767.5 → 표시 1768, TDEE raw 3358.25 → 표시 3358", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 50, heightCm: 178, weightKg: 90 }));
      expect(bmr.display).toBe(1768);
      const tdee = calculateTdee(bmr.raw, 5);
      expect(tdee.raw).toBe(3358.25);
      expect(tdee.display).toBe(3358);
    });

    it("#17: 활동계수 5단계 전부 — 기준 인물 Male 35/175cm/75kg(BMR raw 1673.75 → 표시 1674)", () => {
      const bmr = calculateBmr(metrics({ sex: "male", ageYears: 35, heightCm: 175, weightKg: 75 }));
      expect(bmr.raw).toBe(1673.75);
      expect(bmr.display).toBe(1674);

      const expected: Array<{ level: ActivityLevel; raw: number; display: number }> = [
        { level: 1, raw: 2008.5, display: 2009 },
        { level: 2, raw: 2301.40625, display: 2301 },
        { level: 3, raw: 2594.3125, display: 2594 },
        { level: 4, raw: 2887.21875, display: 2887 },
        { level: 5, raw: 3180.125, display: 3180 },
      ];
      expected.forEach(({ level, raw, display }) => {
        const tdee = calculateTdee(bmr.raw, level);
        expect(tdee.raw).toBeCloseTo(raw, 10);
        expect(tdee.display).toBe(display);
      });
    });

    // ── 핵심 불변식(ARCHITECTURE.md "2.", "8.") ──────────────────────────────────
    it("핵심 불변식: calculateTdee(bmr.raw, ...)는 calculateTdee(bmr.display, ...)와 다른 raw·display를 낳는다 — FORMULA.md #20 재현", () => {
      // FORMULA.md Golden Test #20: 외부 계산기는 반올림된 BMR(1241)에 1.9를 곱해
      // 1241×1.9=2357.9 → 반올림해 2358을 얻지만, 이 계산기는 정책상 반올림 전
      // raw(1241.375)에 곱해 1241.375×1.9=2358.6125 → 반올림해 2359를 얻는다. 두
      // display가 실제로 1kcal 어긋난다는 것을 직접 assert한다.
      const bmrRaw = 1241.375;
      const bmrDisplay = 1241;
      const withRaw = calculateTdee(bmrRaw, 5);
      const withDisplay = calculateTdee(bmrDisplay, 5);
      expect(withRaw.raw).toBeCloseTo(2358.6125, 10);
      expect(withRaw.display).toBe(2359);
      expect(withDisplay.raw).toBe(2357.9);
      expect(withDisplay.display).toBe(2358);
      expect(withRaw.display).not.toBe(withDisplay.display);

      // 경계 사례 — bmrRaw=1000.4(display 1000)에 활동계수 1.9를 곱하면:
      //   raw 기준(올바른 정책):   1000.4 × 1.9 = 1900.76 → 반올림 1901
      //   display 기준(잘못된 사용): 1000   × 1.9 = 1900.0  → 반올림 1900
      // 최종 표시값 자체가 달라진다 — bmr.display를 잘못 넘기면 사용자에게 다른 숫자가
      // 보인다는 것을 직접 증명하는 경계 테스트다.
      const boundaryRaw = calculateTdee(1000.4, 5);
      const boundaryDisplay = calculateTdee(1000, 5);
      expect(boundaryRaw.display).toBe(1901);
      expect(boundaryDisplay.display).toBe(1900);
      expect(boundaryRaw.display).not.toBe(boundaryDisplay.display);
    });

    it("완료 기준 불변식(a): 활동계수가 1.2→1.9로 커질수록 TDEE는 항상 단조 증가한다", () => {
      const bmrRaw = 1673.75;
      const levels: ActivityLevel[] = [1, 2, 3, 4, 5];
      const values = levels.map((level) => calculateTdee(bmrRaw, level).raw);
      for (let i = 1; i < values.length; i += 1) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it("ACTIVITY_FACTORS는 FORMULA.md 표(1.2/1.375/1.55/1.725/1.9)와 정확히 일치한다", () => {
      expect(ACTIVITY_FACTORS).toEqual({ 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 });
    });
  },
);

describe("calculateAllTdeeLevels — 활동계수 5단계 비교표(Should Have, Golden Test #17 재사용)", () => {
  it("기준 인물(Male 35/175/75, BMR raw 1673.75) 5개 행 전부가 calculateTdee 개별 호출 결과와 정확히 일치한다", () => {
    const bmrRaw = 1673.75;
    const rows = calculateAllTdeeLevels(bmrRaw);
    expect(rows).toHaveLength(5);
    rows.forEach((row) => {
      const direct = calculateTdee(bmrRaw, row.activityLevel);
      expect(row.raw).toBe(direct.raw);
      expect(row.display).toBe(direct.display);
    });
    expect(rows.map((r) => r.activityLevel)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("calculateBmrCalculation — 오케스트레이터 조립 (Golden Test #8, #25)", () => {
  it("#8: Female 60/150cm/48kg, 활동량 미선택 — BMR raw 956.5 → 표시 957, TDEE 섹션 자체가 없다(result.tdee === undefined)", () => {
    const result = calculateBmrCalculation(
      input({ sex: "female", ageYears: 60, heightCm: 150, weightKg: 48, activityLevel: null }),
    );
    expect(result.bmr.raw).toBe(956.5);
    expect(result.bmr.display).toBe(957);
    expect(result.tdee).toBeUndefined();
  });

  it("#25: activityLevel이 1~5 범위를 벗어난 값(방어적 코딩 대상)이면 TDEE를 계산하지 않고 BMR만 표시한다", () => {
    const outOfRangeHigh = calculateBmrCalculation(
      input({
        sex: "male",
        ageYears: 30,
        heightCm: 175,
        weightKg: 70,
        activityLevel: 6 as ActivityLevel,
      }),
    );
    expect(outOfRangeHigh.bmr.display).toBe(1649);
    expect(outOfRangeHigh.tdee).toBeUndefined();

    const outOfRangeZero = calculateBmrCalculation(
      input({
        sex: "male",
        ageYears: 30,
        heightCm: 175,
        weightKg: 70,
        activityLevel: 0 as ActivityLevel,
      }),
    );
    expect(outOfRangeZero.bmr.display).toBe(1649);
    expect(outOfRangeZero.tdee).toBeUndefined();
  });

  it("정상 activityLevel(1~5)이면 bmr.raw를 사용해 tdee가 만들어진다(bmr.display가 아니다)", () => {
    const result = calculateBmrCalculation(
      input({ sex: "male", ageYears: 45, heightCm: 180, weightKg: 85, activityLevel: 3 }),
    );
    expect(result.tdee).toBeDefined();
    expect(result.tdee?.raw).toBe(2720.25);
    expect(result.tdee?.display).toBe(2720);
  });

  it("bmrAlternative는 항상 계산된다(activityLevel 선택 여부와 무관, SPEC.md Should Have)", () => {
    const withActivity = calculateBmrCalculation(
      input({ sex: "male", ageYears: 45, heightCm: 180, weightKg: 85, activityLevel: 3 }),
    );
    const withoutActivity = calculateBmrCalculation(
      input({ sex: "male", ageYears: 45, heightCm: 180, weightKg: 85, activityLevel: null }),
    );
    expect(withActivity.bmrAlternative.display).toBe(1835);
    expect(withoutActivity.bmrAlternative.display).toBe(1835);
  });

  it("isValidActivityLevel — 1~5는 true, 그 밖의 값(0, 6, null, undefined, 문자열)은 false", () => {
    expect(isValidActivityLevel(1)).toBe(true);
    expect(isValidActivityLevel(5)).toBe(true);
    expect(isValidActivityLevel(0)).toBe(false);
    expect(isValidActivityLevel(6)).toBe(false);
    expect(isValidActivityLevel(null)).toBe(false);
    expect(isValidActivityLevel(undefined)).toBe(false);
    expect(isValidActivityLevel("3")).toBe(false);
  });
});
