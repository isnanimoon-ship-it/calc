/**
 * 국민연금 예상수령액 계산기 — Golden Test.
 *
 * tasks/national-pension-benefit-estimate/FORMULA.md "검증 예제" 중 14개(#1~#14)를 그대로
 * 옮긴 것이다(#15 "조기/연기 61개월, 입력 오류"는 validation.ts의 책임이라
 * validation.test.ts에 배치한다 — ARCHITECTURE.md "12. Golden Test 배치 전략" 참고).
 *
 * **docs/CALCULATOR_RULES.md "Golden Test — 공식 계산기 예시값과 대조한 케이스 최소 2개"
 * 요건은 이 라운드까지 예제 1(아래) 1건만 충족된 상태다.** FORMULA.md/ARCHITECTURE.md가
 * 이미 명시한 대로, 나머지 1건은 Calculation Auditor의 nps.or.kr(또는 work24.go.kr류)
 * 라이브 계산기 실제 대조로 채워져야 한다 — 이 계산기는 그 대조가 완료되기 전까지
 * registry.ts의 status를 "published"로 전환하지 않는다(tasks/national-pension-benefit-
 * estimate/ARCHITECTURE.md "1. PUBLISHED 전환 게이트").
 *
 * 이 테스트가 "통과"한다고 해서 Builder가 계산기의 정확성을 최종 판정하는 것은 아니다 —
 * 최종 판정은 Calculation Auditor의 몫이다(.claude/agents/builder.md).
 */

import { describe, expect, it } from "vitest";
import rates2026 from "@/src/data/rates-2026.json";
import {
  calculateContributionAdjustmentFactor,
  calculateEarlyOrDeferredAdjustmentRate,
  calculateNationalPensionBenefit,
  findPensionableAgeRow,
} from "./logic";
import type { NationalPensionBenefitFormInput } from "./types";

const rates = rates2026.nationalPensionBenefit;

function baseInput(
  overrides: Partial<NationalPensionBenefitFormInput> = {},
): NationalPensionBenefitFormInput {
  return {
    birthYear: 1965,
    totalContributionMonths: 240,
    averageMonthlyIncome: 3_000_000,
    earlyOrDeferredMonths: 0,
    ...overrides,
  };
}

describe(
  "기본연금액 산식 — 구조 검증(÷12) 및 정상/경계 케이스 (Golden Test #1~4, #7)",
  () => {
    // ── 예제 1 — 공식 구조 검증(÷12 포함), 40년 가입, A=B=250만원 ─────────────────────
    //
    // 출처: 한경매거진/미래에셋투자와연금센터 계산 예시("A=B=250만원, 40년 가입, 비례상수
    // 1.2(구 상수) → 월 100만원"), WebSearch 확인, 확인일 2026-09-13(FORMULA.md 예제 1).
    // 독립 재무 콘텐츠 벤치마크와 정확히 일치하는 유일한 "공식 계산기 대조" 1/2건이다 —
    // 나머지 1건은 Calculation Auditor의 라이브 계산기 대조로 완성 예정(위 파일 상단 주석,
    // "1." 게이트 참고).
    //
    // 이 예제는 이 계산기의 실제 입력(2026년 현재 A값·비례상수 1.29)이 아니라, FORMULA.md
    // "0. 큰 그림"이 설명하는 법정 공식 자체의 구조(특히 ÷12 단계)를 검증하는 순수 수학
    // 예제다 — 벤치마크 원문이 쓴 구 비례상수(1.2)를 그대로 재현한다.
    it("예제 1: 독립 재무 콘텐츠 벤치마크(A=B=250만원, 40년, 구 상수 1.2) — 월 100만원과 정확히 일치", () => {
      const A = 2_500_000;
      const B = 2_500_000;
      const proportionalConstant = 1.2;
      const months = 480;

      const factor = calculateContributionAdjustmentFactor(months, 240, 0.05);
      expect(factor).toBe(2);

      const bracket = proportionalConstant * (A + B) * factor;
      expect(bracket).toBe(12_000_000);

      const basicPensionMonthlyRaw = bracket / 12;
      expect(basicPensionMonthlyRaw).toBe(1_000_000);
    });

    // ── 예제 2 — 2026년 현재값, 20년(240개월) 정확히, 평균소득 300만원 ────────────────
    it("예제 2: 240개월, 평균소득 300만원 — 2026년 현재값 정상 케이스", () => {
      const result = calculateNationalPensionBenefit(baseInput());
      expect(result.eligible).toBe(true);
      if (!result.eligible) return;
      expect(result.bValueApprox).toBe(3_000_000);
      expect(result.bValueClamped).toBe(false);
      expect(result.contributionAdjustmentFactor).toBe(1);
      // 665,802.4325원(완전정밀도)을 10원 미만 절사(내림) — 2026-09-13 정정
      // (nps.or.kr 라이브 계산기 21/21 실증 대조, FORMULA.md 예제 2). 이전 값(원 단위
      // 반올림 665,802원)은 오류였다.
      expect(result.basicPensionMonthly).toBe(665_800);
    });

    // ── 예제 3 — 239개월(20년 1개월 미달, 비례구간 상단 경계 바로 아래) ────────────────
    it("예제 3: 239개월 — 240 미만 경계(비례구간) 바로 아래", () => {
      const result = calculateNationalPensionBenefit(
        baseInput({ totalContributionMonths: 239 }),
      );
      expect(result.eligible).toBe(true);
      if (!result.eligible) return;
      expect(result.contributionAdjustmentFactor).toBeCloseTo(239 / 240, 10);
      // 10원 미만 절사 — 2026-09-13 정정(이전 값 663,028원은 오류였다).
      expect(result.basicPensionMonthly).toBe(663_020);
    });

    // ── 예제 4 — 241개월(20년 초과 1개월, 가산구간 진입 직후 경계) ────────────────────
    it("예제 4: 241개월 — 240 초과 경계(가산구간) 진입 직후", () => {
      const result = calculateNationalPensionBenefit(
        baseInput({ totalContributionMonths: 241 }),
      );
      expect(result.eligible).toBe(true);
      if (!result.eligible) return;
      expect(result.contributionAdjustmentFactor).toBeCloseTo(
        1 + (0.05 * 1) / 12,
        10,
      );
      // 10원 미만 절사 — 2026-09-13 정정(이전 값 668,577원은 오류였다).
      expect(result.basicPensionMonthly).toBe(668_570);
    });

    // ── 예제 7 — 480개월(40년, 전형적 풀타임 커리어 상한) ───────────────────────────
    it("예제 7: 480개월(40년) — 장기가입, 2026년 현재값", () => {
      const result = calculateNationalPensionBenefit(
        baseInput({ totalContributionMonths: 480 }),
      );
      expect(result.eligible).toBe(true);
      if (!result.eligible) return;
      expect(result.contributionAdjustmentFactor).toBe(2);
      // 10원 미만 절사 — 2026-09-13 정정. nps.or.kr 라이브 계산기 대조 완료(21개
      // 데이터포인트 중 하나, 라이브 값 1,331,600원과 정확히 일치). 이전 값(원 단위
      // 반올림 1,331,605원)은 오류였다.
      expect(result.basicPensionMonthly).toBe(1_331_600);
    });

    // ── 완료 기준 불변식(ARCHITECTURE.md "12." 권장) — 240 전후 연속 증가 ─────────────
    it("불변식: totalContributionMonths가 증가할수록 basicPensionMonthly도 단조 증가한다(120~480 스윕)", () => {
      const months = Array.from({ length: 361 }, (_, i) => 120 + i); // 120~480
      const values = months.map((m) => {
        const result = calculateNationalPensionBenefit(
          baseInput({ totalContributionMonths: m }),
        );
        if (!result.eligible) throw new Error("unexpected ineligible");
        return result.basicPensionMonthly;
      });
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });
  },
);

describe("최소 가입기간 경계 (Golden Test #5~6)", () => {
  // ── 예제 5 — 정확히 120개월(최소 가입기간 경계, 요건 충족 최소값) ────────────────
  it("예제 5: 120개월 — 최소 가입기간 경계(충족 쪽), eligible=true", () => {
    const result = calculateNationalPensionBenefit(
      baseInput({ totalContributionMonths: 120 }),
    );
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.contributionAdjustmentFactor).toBe(0.5);
    // 10원 미만 절사 — 2026-09-13 정정. nps.or.kr 라이브 계산기 대조 완료(라이브 값
    // 332,900원과 정확히 일치). 이전 값(원 단위 반올림 332,901원)은 오류였다.
    expect(result.basicPensionMonthly).toBe(332_900);
  });

  // ── 예제 6 — 119개월(최소 가입기간 미달, 경계 바로 아래) ────────────────────────
  it("예제 6: 119개월 — 최소 가입기간 미달, eligible=false(수급개시연령은 계속 계산됨)", () => {
    const result = calculateNationalPensionBenefit(
      baseInput({ totalContributionMonths: 119, birthYear: 1965 }),
    );
    expect(result.eligible).toBe(false);
    if (result.eligible) return;
    expect(result.minEligibleMonths).toBe(120);
    expect(result.totalContributionMonths).toBe(119);
    // FORMULA.md "계산 순서" 2번 — 수급개시연령 판정은 최소 가입기간과 무관하게 항상 수행된다.
    expect(result.pensionableAge).toBe(64);
    expect(result.pensionableYear).toBe(1965 + 64);
  });
});

describe("기준소득월액 clamp (Golden Test #8~9)", () => {
  // ── 예제 8 — 평균소득이 기준소득월액 상한을 초과 (clamp 상단 검증) ──────────────
  it("예제 8: 평균소득 800만원(상한 초과) — 659만원으로 clamp", () => {
    const result = calculateNationalPensionBenefit(
      baseInput({ totalContributionMonths: 240, averageMonthlyIncome: 8_000_000 }),
    );
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.bValueApprox).toBe(6_590_000);
    expect(result.bValueClamped).toBe(true);
    // 10원 미만 절사 — 2026-09-13 정정. nps.or.kr 라이브 계산기 대조 완료(라이브 값
    // 1,051,720원과 정확히 일치). 이전 값(원 단위 반올림 1,051,727원)은 오류였다.
    expect(result.basicPensionMonthly).toBe(1_051_720);
  });

  // ── 예제 9 — 평균소득이 기준소득월액 하한 미만 (clamp 하단 검증) ────────────────
  it("예제 9: 평균소득 30만원(하한 미달) — 41만원으로 clamp", () => {
    const result = calculateNationalPensionBenefit(
      baseInput({ totalContributionMonths: 240, averageMonthlyIncome: 300_000 }),
    );
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.bValueApprox).toBe(410_000);
    expect(result.bValueClamped).toBe(true);
    // 10원 미만 절사 — 2026-09-13 정정(이전 값 387,377원은 오류였다).
    expect(result.basicPensionMonthly).toBe(387_370);
  });
});

describe("수급개시연령 스케줄 경계 (Golden Test #10~12)", () => {
  // ── 예제 10 — 1952년생 vs 1953년생 (60→61세 전환) ─────────────────────────────
  it("예제 10: 1952년생=60세, 1953년생=61세", () => {
    expect(
      findPensionableAgeRow(1952, rates.pensionableAgeSchedule.rows).age,
    ).toBe(60);
    expect(
      findPensionableAgeRow(1953, rates.pensionableAgeSchedule.rows).age,
    ).toBe(61);

    const r1952 = calculateNationalPensionBenefit(baseInput({ birthYear: 1952 }));
    const r1953 = calculateNationalPensionBenefit(baseInput({ birthYear: 1953 }));
    expect(r1952.pensionableAge).toBe(60);
    expect(r1953.pensionableAge).toBe(61);
  });

  // ── 예제 11 — 1956년생 vs 1957년생 (61→62세 전환) ─────────────────────────────
  it("예제 11: 1956년생=61세, 1957년생=62세", () => {
    expect(
      findPensionableAgeRow(1956, rates.pensionableAgeSchedule.rows).age,
    ).toBe(61);
    expect(
      findPensionableAgeRow(1957, rates.pensionableAgeSchedule.rows).age,
    ).toBe(62);
  });

  // ── 예제 12 — 1968년생 vs 1969년생 (64→65세 전환, 최종 65세 도달) ────────────────
  it("예제 12: 1968년생=64세, 1969년생=65세(이후 65세 고정)", () => {
    expect(
      findPensionableAgeRow(1968, rates.pensionableAgeSchedule.rows).age,
    ).toBe(64);
    expect(
      findPensionableAgeRow(1969, rates.pensionableAgeSchedule.rows).age,
    ).toBe(65);
    // 1969 이후 전부 65세 고정(마지막 행 birthYearMax=null).
    expect(
      findPensionableAgeRow(2005, rates.pensionableAgeSchedule.rows).age,
    ).toBe(65);
  });
});

describe("조기노령연금·연기연금 (Golden Test #13~14)", () => {
  // ── 예제 13 — 조기노령연금 최대 한도(5년, 60개월 조기) ─────────────────────────
  it("예제 13: -60개월(최대 조기) — -30% 감액, 절사 전 완전정밀도 기준", () => {
    const result = calculateNationalPensionBenefit(
      baseInput({ earlyOrDeferredMonths: -60 }),
    );
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    // 예제 2와 동일한 조건이므로 basicPensionMonthly(절사 표시값)는 같아야 한다.
    // 10원 미만 절사 — 2026-09-13 정정(이전 값 665,802원은 오류였다).
    expect(result.basicPensionMonthly).toBe(665_800);
    expect(result.earlyOrDeferredAdjustmentRate).toBeCloseTo(-0.3, 10);
    // "절사 전 완전정밀도 기준" 핵심 불변식 검증: basicPensionMonthlyRaw(665,802.4325)에
    // 0.7을 곱한 466,061.70275를 10원 미만 절사하면 466,060원이 된다(2026-09-13 정정,
    // 이전 값 "466,062원(원 단위 반올림)"은 오류였다). 참고: 이 특정 조합에서는
    // basicPensionMonthly(절사 후 표시값 665,800)를 잘못 재사용해도 665,800×0.7=466,060
    // 으로 우연히 같은 값이 나오므로(665,800이 10의 배수라 절사 손실이 없음), -60개월
    // 케이스만으로는 "반드시 raw 값을 써야 한다"는 불변식이 값 차이로 드러나지 않는다 —
    // 이 불변식은 아래 예제 14(+60개월)에서 명확한 값 차이(905,480 vs 905,490)로 검증된다.
    expect(result.adjustedPensionMonthly).toBe(466_060);
  });

  // ── 예제 14 — 연기연금 최대 한도(5년, 60개월 연기) ────────────────────────────
  it("예제 14: +60개월(최대 연기) — +36% 가산, 절사 전 완전정밀도 기준", () => {
    const result = calculateNationalPensionBenefit(
      baseInput({ earlyOrDeferredMonths: 60 }),
    );
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    // 10원 미만 절사 — 2026-09-13 정정(이전 값 665,802원은 오류였다).
    expect(result.basicPensionMonthly).toBe(665_800);
    expect(result.earlyOrDeferredAdjustmentRate).toBeCloseTo(0.36, 10);
    // basicPensionMonthlyRaw(665,802.4325)×1.36=905,491.3082 → 10원 미만 절사 시
    // 905,490원(2026-09-13 정정, 이전 값 "905,491원(원 단위 반올림)"은 오류였다).
    // "절사 전 완전정밀도 기준" 불변식 검증: basicPensionMonthly(절사 후 665,800)를 잘못
    // 재사용했다면 665,800×1.36=905,488 → 절사 후 905,480원(오답)이 나왔을 것이다 —
    // 실제로는 905,490원이 나와야 하므로 이 값 차이(905,480 vs 905,490)가 raw 값을
    // 반드시 써야 하는 이유를 직접 증명한다.
    expect(result.adjustedPensionMonthly).toBe(905_490);
    expect(Math.floor((665_800 * 1.36) / 10) * 10).toBe(905_480); // raw 대신 절사값을 재사용했다면 나왔을 오답(대조용)
  });

  // ── 완료 기준 불변식(ARCHITECTURE.md "12." 권장) — |조정액 - 기본액|은 개월수가 커질수록 증가 ──
  it("불변식: |조정액 - 기본액|은 조기/연기 개월수가 커질수록(같은 부호 안에서) 단조 증가한다", () => {
    const earlySteps = [-12, -24, -36, -48, -60].map((m) => {
      const result = calculateNationalPensionBenefit(
        baseInput({ earlyOrDeferredMonths: m }),
      );
      if (!result.eligible || result.adjustedPensionMonthly === undefined) {
        throw new Error("unexpected");
      }
      return result.basicPensionMonthly - result.adjustedPensionMonthly;
    });
    for (let i = 1; i < earlySteps.length; i++) {
      expect(earlySteps[i]).toBeGreaterThan(earlySteps[i - 1]);
    }

    const deferredSteps = [12, 24, 36, 48, 60].map((m) => {
      const result = calculateNationalPensionBenefit(
        baseInput({ earlyOrDeferredMonths: m }),
      );
      if (!result.eligible || result.adjustedPensionMonthly === undefined) {
        throw new Error("unexpected");
      }
      return result.adjustedPensionMonthly - result.basicPensionMonthly;
    });
    for (let i = 1; i < deferredSteps.length; i++) {
      expect(deferredSteps[i]).toBeGreaterThan(deferredSteps[i - 1]);
    }
  });

  it("calculateEarlyOrDeferredAdjustmentRate — 0개월이면 0을 반환한다", () => {
    expect(
      calculateEarlyOrDeferredAdjustmentRate(
        0,
        rates.earlyPension,
        rates.deferredPension,
      ),
    ).toBe(0);
  });
});
