/**
 * 실업급여(구직급여) 계산기 — Golden Test.
 *
 * tasks/unemployment-benefit/FORMULA.md "검증 예제" 1~6을 그대로 옮긴 것이다.
 *
 * **정직한 한계 고지(FORMULA.md 원문 그대로)**: FORMULA.md는 "이 문서의 신뢰도에 관한 중요한
 * 사전 고지"에서 다음을 명시한다 — "'공식 계산기가 실제로 출력한 최종 금액'과 1:1로 대조된
 * Golden Test 예제는 이번 조사에서 확보하지 못했다. docs/CALCULATOR_RULES.md가 요구하는
 * '공식 계산기 예시값과 대조한 케이스 최소 2개'는 미충족 상태로 남기며, 아래 '여전히
 * 남아있는 확인 필요 항목'에 명시한다. QA/Calculation Auditor 단계에서 work24.go.kr(고용24)
 * 모의계산기를 사람이 직접 조작해 결과 화면을 캡처하는 방식으로 이 요건을 채우는 것을 강력히
 * 권고한다." 아래 각 테스트의 라벨은 FORMULA.md 검증 예제 절의 라벨 문구를 그대로 옮긴 것이며,
 * "공식 계산기 대조"인 것처럼 과장하지 않는다.
 *
 * 이 테스트가 "통과"한다고 해서 Builder가 계산기의 정확성을 최종 판정하는 것은 아니다 —
 * 최종 판정은 Calculation Auditor의 몫이다(.claude/agents/builder.md).
 */

import { describe, expect, it } from "vitest";
import {
  calculateBaseDays,
  calculateUnemploymentBenefit,
  determineAgeBand,
  determineInsuredPeriodBand,
  finalizeTotalBenefit,
} from "./logic";
import { formatBenefitDailyAmountDisplay } from "./formatting";
import type { UnemploymentBenefitCalcInput } from "./types";

describe("calculateUnemploymentBenefit — Golden Test (FORMULA.md 검증 예제)", () => {
  // ── 예제 1 — 상한액 적용 (50세 이상, 10년 이상 가입, 고액 연봉) ────────────────────────
  // 라벨(FORMULA.md 원문): "자체 산식 재현(상한 적중 케이스). 공식 계산기 대조 아님."
  it("예제 1: 상한액 적용 (50세 이상, 10년 이상 가입, 고액 연봉) — 공식 계산기 대조 아님", () => {
    const input: UnemploymentBenefitCalcInput = {
      leaveDate: "2026-08-01",
      ageAtLeave: 55,
      isDisabled: false,
      insuredPeriodDays: 4_380, // 10년 이상
      wage3m: 30_000_000,
    };

    const result = calculateUnemploymentBenefit(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.baseDays).toBe(92);
    expect(result.averageDailyWage).toBeCloseTo(326_086.9565, 3);
    expect(result.baseBenefitDailyAmount).toBeCloseTo(195_652.1739, 3);
    // 2026년 상한액(68,100원)을 크게 초과 → 상한 적용.
    expect(result.benefitDailyAmount).toBe(68_100);
    expect(result.ageBandForTable).toBe("50세 이상 및 장애인");
    expect(result.insuredPeriodBand).toBe("10년 이상");
    expect(result.prescribedBenefitDays).toBe(270);
    expect(result.totalExpectedBenefit).toBe(18_387_000);
  });

  // ── 예제 2 — 하한액 적용 (50세 미만, 3~5년 가입, 평범한 임금) — 독립 출처와 수치 일치 ──
  // 라벨(FORMULA.md 원문): "자체 산식 재현(하한 적중 케이스), 독립 2차 출처와 수치 일치 확인.
  // 독립된 민간 정보 블로그(공식 계산기 아님, 정확한 URL은 검색 스니펫으로만 확인)가
  // '월급 300만원, 45세, 가입 4년' 조건에서 동일하게 '66,048원×180일=11,888,640원'을
  // 제시한 것을 확인했다(WebSearch, 확인일 2026-09-02) — 산식·수치를 각각 독립적으로
  // 재현해 일치를 확인한 것이며, 그 블로그를 그대로 신뢰한 것은 아니다."
  it("예제 2: 하한액 적용 (50세 미만, 3~5년 가입) — 독립 2차 출처와 수치 일치(공식 계산기 대조는 아님)", () => {
    const input: UnemploymentBenefitCalcInput = {
      leaveDate: "2026-08-01",
      ageAtLeave: 45,
      isDisabled: false,
      insuredPeriodDays: 1_460, // 3년 이상 5년 미만 (4년)
      wage3m: 9_000_000, // 월 300만원×3
    };

    const result = calculateUnemploymentBenefit(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.baseDays).toBe(92);
    expect(result.averageDailyWage).toBeCloseTo(97_826.0869, 3);
    expect(result.baseBenefitDailyAmount).toBeCloseTo(58_695.6521, 3);
    // 2026년 하한액(66,048원)보다 낮음 → 하한 적용.
    expect(result.benefitDailyAmount).toBe(66_048);
    expect(result.ageBandForTable).toBe("50세 미만");
    expect(result.insuredPeriodBand).toBe("3년 이상 5년 미만");
    expect(result.prescribedBenefitDays).toBe(180);
    expect(result.totalExpectedBenefit).toBe(11_888_640);
  });

  // ── 예제 3 — 상한·하한 사이 (50세 이상, 5~10년 가입) ────────────────────────────────
  // 라벨(FORMULA.md 원문): "자체 구성 라운드넘버 케이스(공식 대조 아님). 상한·하한 어느
  // 쪽도 적용되지 않는 '일반 케이스'의 산식 정합성 확인용."
  it("예제 3: 상한·하한 사이 (50세 이상, 5~10년 가입) — 자체 구성 라운드넘버, 공식 대조 아님", () => {
    const input: UnemploymentBenefitCalcInput = {
      leaveDate: "2026-08-01",
      ageAtLeave: 52,
      isDisabled: false,
      insuredPeriodDays: 2_190, // 5년 이상 10년 미만 (6년)
      wage3m: 10_304_000,
    };

    const result = calculateUnemploymentBenefit(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.baseDays).toBe(92);
    expect(result.averageDailyWage).toBe(112_000); // 나누어떨어지는 라운드넘버
    expect(result.baseBenefitDailyAmount).toBe(67_200);
    // 66,048원(하한) < 67,200원 < 68,100원(상한) → clamp 없이 그대로 사용.
    expect(result.benefitDailyAmount).toBe(67_200);
    expect(result.ageBandForTable).toBe("50세 이상 및 장애인");
    expect(result.insuredPeriodBand).toBe("5년 이상 10년 미만");
    expect(result.prescribedBenefitDays).toBe(240);
    expect(result.totalExpectedBenefit).toBe(16_128_000);
  });

  // ── 예제 4 — 수급자격 요건 미충족 (피보험기간 180일 미만) ───────────────────────────
  // 라벨(FORMULA.md 원문): "공식 대조 아님(법조문 요건 자체를 검증하는 예제)."
  it("예제 4: 수급자격 요건 미충족 (피보험기간 180일 미만) — 공식 대조 아님", () => {
    const input: UnemploymentBenefitCalcInput = {
      leaveDate: "2026-08-01",
      ageAtLeave: 40,
      insuredPeriodDays: 150,
      wage3m: 6_000_000,
    };

    const result = calculateUnemploymentBenefit(input);

    expect(result).toEqual({
      eligible: false,
      eligibleByInsuredPeriod: false,
    });
  });

  // ── 예제 5 — 경계값(정확히 180일) + 최소 구간 + 하한액 동시 검증 ────────────────────
  // 라벨(FORMULA.md 원문): "경계값(180일 정확히) + 최소 소정급여일수(120일) + 하한액 적용을
  // 동시에 검증하는 자체 구성 케이스. 공식 대조 아님."
  it("예제 5: 경계값(정확히 180일) + 최소 구간 + 하한액 동시 검증 — 자체 구성, 공식 대조 아님", () => {
    const input: UnemploymentBenefitCalcInput = {
      leaveDate: "2026-08-01",
      ageAtLeave: 30,
      isDisabled: false,
      insuredPeriodDays: 180, // 요건을 "이상"으로 충족하는 최소 경계
      wage3m: 6_000_000, // 월 200만원×3
    };

    const result = calculateUnemploymentBenefit(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.baseDays).toBe(92);
    expect(result.averageDailyWage).toBeCloseTo(65_217.3913, 3);
    expect(result.baseBenefitDailyAmount).toBeCloseTo(39_130.4347, 3);
    // 하한액(66,048원)보다 훨씬 낮음 → 하한 적용.
    expect(result.benefitDailyAmount).toBe(66_048);
    expect(result.ageBandForTable).toBe("50세 미만");
    // insuredPeriodDays=180일은 "1년 미만" 구간(180일~364일)에 해당.
    expect(result.insuredPeriodBand).toBe("1년 미만");
    expect(result.prescribedBenefitDays).toBe(120);
    expect(result.totalExpectedBenefit).toBe(7_925_760);
  });

  // ── 예제 6 — 연령 경계값(정확히 50세) ──────────────────────────────────────────────
  // 라벨(FORMULA.md 원문): "연령 50세 경계값 테스트(자체 구성, 공식 대조 아님)."
  it("예제 6: 연령 경계값(정확히 50세) — 자체 구성, 공식 대조 아님", () => {
    const input: UnemploymentBenefitCalcInput = {
      leaveDate: "2026-08-01",
      ageAtLeave: 50, // 정확히 50세
      isDisabled: false,
      insuredPeriodDays: 730, // 1년 이상 3년 미만 (2년)
      wage3m: 10_304_000,
    };

    const result = calculateUnemploymentBenefit(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    // "50세 미만" 구간이 아니라 "50세 이상 및 장애인" 구간으로 판정되어야 한다.
    expect(result.ageBandForTable).toBe("50세 이상 및 장애인");
    expect(result.baseDays).toBe(92);
    expect(result.averageDailyWage).toBe(112_000);
    expect(result.baseBenefitDailyAmount).toBe(67_200); // 상한·하한 사이, clamp 없음
    expect(result.insuredPeriodBand).toBe("1년 이상 3년 미만");
    // 50세 미만이었다면 150일이었을 것 — 경계 오판 시 오답이 되는 지점.
    expect(result.prescribedBenefitDays).toBe(180);
    expect(result.totalExpectedBenefit).toBe(12_096_000);
  });

  // ── 예제 7 — 신규: 구직급여일액 반올림 정책 변경의 실질적 효과 ──────────────────────
  // 라벨(FORMULA.md 원문): "work24.go.kr 실제 계산기 대조로 확인됨 — 반올림 정책 변경(절사
  // 폐기, 완전정밀도 유지)의 효과를 직접 보여주는 핵심 예제." 예제 3(wage3m=10,304,000원)과
  // 입력이 92원만 다르다(10,304,092원) — averageDailyWage가 정확히 112,001원(정수)이 되어
  // baseBenefitDailyAmount=112,001×0.6=67,200.6원(소수 발생)이 되도록 구성됐다. 구 정책
  // ("clamp 후 절사, 그 절사값으로 총액 계산")이었다면 67,200원×240일=16,128,000원이었을
  // 것이지만, 새 정책(완전정밀도 유지)에서는 67,200.6원×240일=16,128,144원이 되어야 하고,
  // 이는 work24.go.kr 라이브 계산 서버(ave_sal=112001, prd=72개월, old=52)의 실제 응답
  // tot=16,128,144와 정확히 일치한다(EVALUATION.md 2-c, 확인일 2026-09-02).
  it("예제 7: 구직급여일액 반올림 정책 변경의 실질적 효과 — work24.go.kr 실제 계산기 대조로 확인됨", () => {
    const input: UnemploymentBenefitCalcInput = {
      leaveDate: "2026-08-01",
      ageAtLeave: 52,
      isDisabled: false,
      insuredPeriodDays: 2_190, // 5년 이상 10년 미만 (6년, 예제 3과 동일)
      wage3m: 10_304_092, // 예제 3의 10,304,000원 + 92원
    };

    const result = calculateUnemploymentBenefit(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.baseDays).toBe(92);
    expect(result.averageDailyWage).toBe(112_001); // 정수로 나누어떨어짐
    // 66,048원(하한) < 67,200.6원 < 68,100원(상한) → clamp 없이 소수점 유지.
    expect(result.baseBenefitDailyAmount).toBeCloseTo(67_200.6, 6);
    // 구직급여일액(계산용)은 절사하지 않고 완전정밀도(67,200.6원)를 그대로 유지한다 —
    // 구 정책이었다면 67,200원(정수)이었을 지점.
    expect(result.benefitDailyAmount).toBeCloseTo(67_200.6, 6);
    expect(result.ageBandForTable).toBe("50세 이상 및 장애인");
    expect(result.insuredPeriodBand).toBe("5년 이상 10년 미만");
    expect(result.prescribedBenefitDays).toBe(240); // 예제 3과 동일
    // 핵심 검증: 67,200.6 × 240 = 16,128,144원 (구 정책이었다면 67,200 × 240 = 16,128,000원).
    expect(result.totalExpectedBenefit).toBe(16_128_144);
  });
});

describe("calculateUnemploymentBenefit — Edge Case Test", () => {
  it("insuredPeriodDays가 0이면(음수 아님, 최소값) 수급자격 요건 미충족으로 처리된다", () => {
    const result = calculateUnemploymentBenefit({
      leaveDate: "2026-08-01",
      ageAtLeave: 30,
      insuredPeriodDays: 0,
      wage3m: 6_000_000,
    });
    expect(result).toEqual({ eligible: false, eligibleByInsuredPeriod: false });
  });

  it("insuredPeriodDays가 179일(경계 바로 아래)이면 수급자격 요건 미충족이다", () => {
    const result = calculateUnemploymentBenefit({
      leaveDate: "2026-08-01",
      ageAtLeave: 30,
      insuredPeriodDays: 179,
      wage3m: 6_000_000,
    });
    expect(result.eligible).toBe(false);
  });

  it("isDisabled=true이면 연령이 50세 미만이어도 '50세 이상 및 장애인' 구간으로 판정된다", () => {
    const result = calculateUnemploymentBenefit({
      leaveDate: "2026-08-01",
      ageAtLeave: 25,
      isDisabled: true,
      insuredPeriodDays: 400,
      wage3m: 6_000_000,
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.ageBandForTable).toBe("50세 이상 및 장애인");
  });

  it("가입기간 정확히 365일(1년 경계)이면 '1년 이상 3년 미만' 구간이다", () => {
    const result = calculateUnemploymentBenefit({
      leaveDate: "2026-08-01",
      ageAtLeave: 30,
      insuredPeriodDays: 365,
      wage3m: 6_000_000,
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.insuredPeriodBand).toBe("1년 이상 3년 미만");
  });

  it("가입기간 364일(1년 경계 바로 아래)이면 '1년 미만' 구간이다", () => {
    const result = calculateUnemploymentBenefit({
      leaveDate: "2026-08-01",
      ageAtLeave: 30,
      insuredPeriodDays: 364,
      wage3m: 6_000_000,
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.insuredPeriodBand).toBe("1년 미만");
  });

  it("가입기간이 매우 긴 값(3650일=10년 정확히)이면 '10년 이상' 구간이다", () => {
    const result = calculateUnemploymentBenefit({
      leaveDate: "2026-08-01",
      ageAtLeave: 60,
      insuredPeriodDays: 3_650,
      wage3m: 6_000_000,
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.insuredPeriodBand).toBe("10년 이상");
  });

  it("2026년 외 연도(leaveDate) 입력 시 데이터가 없다는 에러를 던진다(v1 결정: 조용한 폴백 금지)", () => {
    expect(() =>
      calculateUnemploymentBenefit({
        leaveDate: "2025-08-01",
        ageAtLeave: 30,
        insuredPeriodDays: 400,
        wage3m: 6_000_000,
      }),
    ).toThrow(/2025년 데이터가 없습니다/);
  });

  it("finalizeTotalBenefit: 곱셈 결과에 대해서만 최종적으로 원 단위 절사(버림)한다", () => {
    // FORMULA.md "정밀도/반올림 정책"(2026-09-02 갱신) — 예제 7과 동일한 소수(67,200.6원).
    expect(finalizeTotalBenefit(67_200.6, 240)).toBe(16_128_144);
    expect(finalizeTotalBenefit(66_048, 120)).toBe(7_925_760); // 정수 입력은 항등적으로 절사됨
    // 곱셈 자체가 소수로 끝나는 경우(절사 정책이 실제로 값을 바꾸는 경우)도 확인.
    expect(finalizeTotalBenefit(100.999, 3)).toBe(302); // 302.997 → 302
  });

  it("formatBenefitDailyAmountDisplay(표시 전용)는 원 미만을 절사(버림)하지만, 계산 경로(finalizeTotalBenefit)에는 영향을 주지 않는다", () => {
    expect(formatBenefitDailyAmountDisplay(66_048.99)).toBe("66,048원");
    expect(formatBenefitDailyAmountDisplay(66_048)).toBe("66,048원"); // 정수는 항등
    // 표시용으로 절사된 값(67,200원)을 계산에 다시 넣으면 예제 7의 실제 값(16,128,144원)과
    // 달라진다는 것을 대비해서 보여준다 — 이 절사값은 실제 계산 경로에 재사용되지 않는다.
    expect(finalizeTotalBenefit(67_200, 240)).toBe(16_128_000); // 표시용 절사값을 썼다면 이 값(구 정책, 폐기됨)
    expect(finalizeTotalBenefit(67_200.6, 240)).toBe(16_128_144); // 실제 계산 경로(완전정밀도)는 이 값
  });

  it("determineAgeBand: 49세는 '50세 미만'이다(경계 바로 아래)", () => {
    expect(determineAgeBand(49, false)).toBe("50세 미만");
  });

  it("calculateBaseDays: 월말 clamp 규칙이 severance-pay와 동일하게 적용된다", () => {
    // clamp: 2024-05-31의 3개월 전 "2월 31일"은 존재하지 않음 → 2024-02-29(윤년)로 clamp.
    expect(calculateBaseDays("2024-05-31")).toBe(92);
  });

  it("determineInsuredPeriodBand: 표 범위를 벗어나지 않는 한 항상 구간을 찾는다(매우 큰 값)", () => {
    const rows = [
      { insuredYearsMin: 0, insuredYearsMax: 1, under50Days: 120, over50OrDisabledDays: 120 },
      { insuredYearsMin: 1, insuredYearsMax: 3, under50Days: 150, over50OrDisabledDays: 180 },
      { insuredYearsMin: 3, insuredYearsMax: 5, under50Days: 180, over50OrDisabledDays: 210 },
      { insuredYearsMin: 5, insuredYearsMax: 10, under50Days: 210, over50OrDisabledDays: 240 },
      { insuredYearsMin: 10, insuredYearsMax: null, under50Days: 240, over50OrDisabledDays: 270 },
    ];
    const { band } = determineInsuredPeriodBand(100_000, rows);
    expect(band).toBe("10년 이상");
  });

  it("매우 큰 임금총액 입력에서도 안전한 정수 범위 내에서 계산된다", () => {
    const result = calculateUnemploymentBenefit({
      leaveDate: "2026-08-01",
      ageAtLeave: 40,
      insuredPeriodDays: 4_000,
      wage3m: 9_000_000_000, // 90억원(검증 상한 근처)
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(Number.isFinite(result.totalExpectedBenefit)).toBe(true);
    expect(Number.isSafeInteger(result.totalExpectedBenefit)).toBe(true);
    // 고액 임금이므로 상한액이 적용되어야 한다.
    expect(result.benefitDailyAmount).toBe(68_100);
  });
});
