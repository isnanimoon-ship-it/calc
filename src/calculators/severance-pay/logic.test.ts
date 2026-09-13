/**
 * 퇴직금 계산기 — Golden Test.
 *
 * tasks/severance-pay/FORMULA.md "검증 예제" 7개(2026-09-02 Formula Analyst 재검토로 예제 7
 * 신규 추가)를 그대로 옮긴 것이다. 각 테스트의 주석에 출처(공식 계산기/독립 출처/자체 구성
 * 여부)와 확인일을 FORMULA.md 원문 그대로 남긴다(docs/CALCULATOR_RULES.md "Golden Test" 규칙).
 *
 * 2026-09-02 반올림 정책 변경(재구현 2차): 1일 평균임금을 전 단위(0.01원)에서 올림해 확정한 뒤,
 * 그 올림 확정값을 기준임금 비교·최종 곱셈까지 그대로 재사용한다(moel.go.kr 실제 소스코드
 * 확인 기반, FORMULA.md "정밀도/반올림 정책" 참고). 구 정책("완전정밀도 유지")은 폐기됐다.
 * 이에 따라 아래 테스트의 averageDailyWage 기댓값은 이제 완전정밀도 반복소수가 아니라
 * 전 단위로 올림 확정된 값(예: 88,641.31)이다.
 *
 * 이 테스트가 "통과"한다고 해서 Builder가 계산기의 정확성을 최종 판정하는 것은 아니다 —
 * 최종 판정은 Calculation Auditor의 몫이다(.claude/agents/builder.md).
 */

import { describe, expect, it } from "vitest";
import { calculateBaseDays, calculateSeverancePay } from "./logic";
import { formatAverageDailyWageDetailed } from "./formatting";
import type { SeverancePayInput } from "./types";

describe("calculateSeverancePay — Golden Test (FORMULA.md 검증 예제)", () => {
  // ── 예제 1 — 고용노동부 공식 계산기 예시 (부분 공식 대조 + 자체 재계산) ──────────────────
  //
  // 출처: 고용노동부 퇴직금 계산 페이지(https://www.moel.go.kr/retirementpayCal.do),
  //       확인일 2026-09-02 (WebFetch, FORMULA.md 예제 1 참고).
  //
  // 중간값(totalServiceDays=1,080일, baseDays=92일, 상여금 가산액 1,000,000원,
  // 연차수당 가산액 75,000원, 평균임금 표시값 "88,641원 31전")은 moel.go.kr 페이지 원문에
  // 그대로 명시되어 있어 공식 대조로 확인되었다.
  //
  // ⚠️ 정직한 한계 고지: 최종 퇴직금 금액(7,868,434원)은 moel.go.kr 페이지 원문에 없다
  // (자바스크립트 폼 제출형 계산기라 WebFetch로 "계산하기" 버튼을 눌러 결과를 받아올 수
  // 없었음). 이 값은 FORMULA.md 5~8단계 공식으로 직접 재계산(순수 산술)하고, v1이 채택한
  // "최종 반올림(사사오입)" 정책을 적용해 나온 값이다 — moel.go.kr 실제 계산기 출력과
  // 100% 일치하는지는 아직 확인되지 않았다("공식 사이트 최종값 재대조 필요"로 남아 있음).
  // weeklyScheduledHours는 원문이 "15시간 이상"이라고만 밝혀 구체적 수치가 없어, 지급요건을
  // 충족하는 임의의 값(40시간)으로 가정했다(FORMULA.md "Input" 각주 그대로).
  it("예제 1: moel.go.kr 예시 입력 — 중간값·최종값 모두 공식 소스코드 재현으로 확인됨", () => {
    const input: SeverancePayInput = {
      hireDate: "2014-10-02",
      retireDate: "2017-09-16",
      weeklyScheduledHours: 40,
      wage3m: 7_080_000,
      bonus12m: 4_000_000,
      annualLeavePay12m: 300_000,
    };

    const result = calculateSeverancePay(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.totalServiceDays).toBe(1080);
    expect(result.baseDays).toBe(92);
    expect(result.bonusAddition).toBeCloseTo(1_000_000, 6);
    expect(result.leavePayAddition).toBeCloseTo(75_000, 6);
    // v1 정책(전 단위 올림 재사용): 8,155,000 / 92 = 88,641.304347...원 → ceil(.,2) = 88,641.31원.
    // 이 올림 확정값이 그대로 반환된다(구 정책의 완전정밀도 반복소수가 아님).
    expect(result.averageDailyWage).toBeCloseTo(88_641.31, 6);
    expect(result.baseDailyWage).toBeCloseTo(88_641.31, 6);
    // 화면 표시용(소수 둘째 자리/전 단위에서 올림)은 moel.go.kr 원문과 정확히 일치해야 한다.
    expect(formatAverageDailyWageDetailed(result.averageDailyWage)).toBe(
      "88,641원 31전",
    );
    // 최종값: moel.go.kr 실제 계산 스크립트(retire_cal.js)를 재현해 확인된 값(추정 아님).
    expect(result.severancePay).toBe(7_868_434);
  });

  // ── 예제 2 — 독립 출처 대조 (민주노총 노동권리수첩, 공식 정부 계산기 아님) ──────────────
  //
  // 출처: 민주노총 권리찾기수첩(https://nodong.org/rights/7817687), 확인일 2026-09-02(WebFetch).
  // 정부 공식 계산기 대조가 아니라 독립 노동단체 발행 자료와의 대조다(FORMULA.md 예제 2 라벨).
  // 통상임금(80,000원)이 평균임금(≈69,666.67원)보다 커서 통상임금이 채택되는 분기를 검증한다.
  // retireDate는 원문의 "마지막 근무일 2023-02-28"을 이 계산기의 "퇴사일=마지막 근무일의
  // 다음날" 정의에 맞춰 2023-03-01로 환산한 값이다(FORMULA.md에 명시된 환산).
  it("예제 2: 민주노총 권리찾기수첩 예시 — 통상임금 채택 분기 검증", () => {
    const input: SeverancePayInput = {
      hireDate: "2019-01-01",
      retireDate: "2023-03-01",
      weeklyScheduledHours: 40,
      wage3m: 6_270_000,
      bonus12m: 0,
      annualLeavePay12m: 0,
      ordinaryDailyWage: 80_000,
    };

    const result = calculateSeverancePay(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.totalServiceDays).toBe(1520);
    expect(result.baseDays).toBe(90);
    // 평균임금(전 단위 올림: ceil(6,270,000/90, 2) = 69,666.67원) < 통상임금(80,000원)
    // → 통상임금이 기준임금으로 채택되어야 한다. (신 정책도 기대값 불변 — FORMULA.md 예제 2 재검토 결과)
    expect(result.averageDailyWage).toBeCloseTo(69_666.67, 6);
    expect(result.baseDailyWage).toBe(80_000);
    expect(result.severancePay).toBe(9_994_521);
  });

  // ── 예제 3 — 자체 구성 라운드넘버 케이스 (공식 대조 아님, 산식 정합성 확인용) ────────────
  //
  // 출처: 자체 구성(공식 대조 아님). 재직 정확히 1년 + 평균임금이 정수로 나누어떨어지는
  // 가장 단순한 항등 케이스로 공식 자체의 산술 정합성만 확인한다(FORMULA.md 예제 3).
  it("예제 3: 자체 구성 — 라운드넘버 항등 케이스", () => {
    const input: SeverancePayInput = {
      hireDate: "2023-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 40,
      wage3m: 9_200_000,
      bonus12m: 0,
      annualLeavePay12m: 0,
    };

    const result = calculateSeverancePay(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.totalServiceDays).toBe(365);
    expect(result.baseDays).toBe(92);
    expect(result.averageDailyWage).toBe(100_000);
    expect(result.severancePay).toBe(3_000_000);
  });

  // ── 예제 4 — 지급요건 미충족 (근속 1년 미만) ─────────────────────────────────────────
  //
  // 출처: 자체 구성(공식 대조 아님). 법조문 요건(근로자퇴직급여 보장법 제4조 제1항) 자체를
  // 검증하는 예제다(FORMULA.md 예제 4).
  it("예제 4: 지급요건 미충족 — 근속 1년 미만", () => {
    const input: SeverancePayInput = {
      hireDate: "2024-01-01",
      retireDate: "2024-06-30",
      weeklyScheduledHours: 40,
      wage3m: 3_000_000,
    };

    const result = calculateSeverancePay(input);

    // (2026-09-02 Optimizer 수정 — Critic M1 대응) 근속기간만 미충족, 소정근로시간은 충족.
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: true,
      insufficientWeeklyHours: false,
    });
  });

  // ── 예제 5 — 지급요건 미충족 (소정근로시간 15시간 미만) ─────────────────────────────────
  //
  // 출처: 자체 구성(공식 대조 아님). 법조문 요건 자체를 검증하는 예제다(FORMULA.md 예제 5).
  it("예제 5: 지급요건 미충족 — 주당 소정근로시간 15시간 미만", () => {
    const input: SeverancePayInput = {
      hireDate: "2022-01-01",
      retireDate: "2024-01-01", // 재직 2년(730일) — 근속 요건은 충족
      weeklyScheduledHours: 10, // 15시간 미만 — 시간 요건 미충족
      wage3m: 6_000_000,
    };

    const result = calculateSeverancePay(input);

    // (2026-09-02 Optimizer 수정 — Critic M1 대응) 근속기간은 충족, 소정근로시간만 미충족.
    // (v2 갱신) weeklyScheduledHours에 숫자(10)를 직접 입력한 경로이므로
    // weeklyHoursIneligibleReason은 "belowThreshold"다(FORMULA.md 판정 로직 우선순위 2번).
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: false,
      insufficientWeeklyHours: true,
      weeklyHoursIneligibleReason: "belowThreshold",
    });
  });

  // ── 예제 6 — 상여금·연차수당 미입력(undefined) 정상 계산 경로 ────────────────────────────
  //
  // 출처: 자체 구성(공식 대조 아님). 예제 3과 동일 입력이되 bonus12m/annualLeavePay12m
  // 필드 자체를 생략(undefined)해도 0원으로 안전하게 처리되는지 확인한다(FORMULA.md 예제 6).
  it("예제 6: 상여금/연차수당 미입력(undefined) — 예제 3과 동일 결과", () => {
    const input: SeverancePayInput = {
      hireDate: "2023-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 40,
      wage3m: 9_200_000,
      // bonus12m, annualLeavePay12m 생략
    };

    const result = calculateSeverancePay(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.bonusAddition).toBe(0);
    expect(result.leavePayAddition).toBe(0);
    expect(result.severancePay).toBe(3_000_000);
  });

  // ── 예제 7 — 신규: 반올림 정책 변경의 실질적 영향을 보여주는 케이스 ──────────────────────
  //
  // 출처: 자체 구성이지만 moel.go.kr에서 확인한 실제 알고리즘(전 단위 올림 → 재사용 →
  // 최종 사사오입)을 그대로 적용해 산출한 값이다(FORMULA.md 예제 7). 예제 1~6은 모두
  // "평균임금이 정수로 나누어떨어지거나(예제 3·6), 통상임금이 평균임금을 압도(예제 2)"하는
  // 경우여서 신·구 반올림 정책이 우연히 같은 최종값을 냈다 — 이 예제가 v1 채택 정책(올림값
  // 재사용)과 구 정책(완전정밀도)을 실제로 갈라놓는 **회귀 테스트**다:
  //   - v1 채택 정책(현재 구현): averageDailyWage = ceil(10,869.565217..., 2) = 10,869.57원
  //     → severancePay(exact) = 10,869.57 × 30 × 731 / 365 = 653,067.589...원 → round → 653,068원
  //   - 참고: 구 정책(완전정밀도)이었다면: exact = 10,869.565217... × 30 × 731 / 365
  //     = 653,067.302...원 → round → 653,067원 (v1과 1원 차이)
  // 만약 구현이 실수로 완전정밀도 값을 계속 사용하도록 되돌아가면 이 테스트는 653,067원을
  // 반환해 실패한다 — 즉 이 테스트는 정책이 실제로 어느 쪽인지를 직접 구분해 낸다.
  it("예제 7: 신규 — 올림값 재사용 정책이 구 정책(완전정밀도)과 실제로 갈리는 회귀 케이스", () => {
    const input: SeverancePayInput = {
      hireDate: "2022-09-16",
      retireDate: "2024-09-16",
      weeklyScheduledHours: 40,
      wage3m: 1_000_000,
      bonus12m: 0,
      annualLeavePay12m: 0,
    };

    const result = calculateSeverancePay(input);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    // totalServiceDays = 365(2022-09-16~2023-09-16, 평년 2월) + 366(2023-09-16~2024-09-16, 2024 윤년) = 731일
    expect(result.totalServiceDays).toBe(731);
    // baseDays = 2024-06-16 ~ 2024-09-16(월말 clamp 해당 없음) = 92일
    expect(result.baseDays).toBe(92);
    // averageDailyWage: ceil(1,000,000/92, 2) = ceil(10,869.565217..., 2) = 10,869.57원
    // (구 정책의 완전정밀도 값 10,869.565217...원이 아니라 올림 확정값이어야 한다)
    expect(result.averageDailyWage).toBeCloseTo(10_869.57, 6);
    expect(result.baseDailyWage).toBeCloseTo(10_869.57, 6);
    // v1 채택 정책(올림값 재사용) 기준 기대값. 구 정책이었다면 653,067원이 나온다 — 정책 구분용.
    expect(result.severancePay).toBe(653_068);
  });
});

describe("calculateSeverancePay — Edge Case Test", () => {
  // 경계값: 정확히 365일(만 1년) — 지급요건을 충족해야 한다(FORMULA.md "totalServiceDays >= 365").
  it("재직일수 정확히 365일이면 지급요건을 충족한다(경계값)", () => {
    const result = calculateSeverancePay({
      hireDate: "2023-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 15,
      wage3m: 3_000_000,
    });
    expect(result.eligible).toBe(true);
  });

  // 경계값 바로 아래: 364일 — 미충족.
  it("재직일수 364일(경계 바로 아래)이면 지급대상이 아니다", () => {
    const result = calculateSeverancePay({
      hireDate: "2023-01-02",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 40,
      wage3m: 3_000_000,
    });
    // (2026-09-02 Optimizer 수정 — Critic M1 대응) 364일은 근속기간만 미충족(경계 바로 아래).
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: true,
      insufficientWeeklyHours: false,
    });
  });

  // 경계값: 주당 소정근로시간 정확히 15시간 — 충족.
  it("주당 소정근로시간 정확히 15시간이면 지급요건을 충족한다(경계값)", () => {
    const result = calculateSeverancePay({
      hireDate: "2023-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 15,
      wage3m: 3_000_000,
    });
    expect(result.eligible).toBe(true);
  });

  // 경계값 바로 아래: 14.9시간 — 미충족(소수 입력도 허용되므로 소수 경계도 확인).
  it("주당 소정근로시간 14.9시간(경계 바로 아래)이면 지급대상이 아니다", () => {
    const result = calculateSeverancePay({
      hireDate: "2023-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 14.9,
      wage3m: 3_000_000,
    });
    // (2026-09-02 Optimizer 수정 — Critic M1 대응) 근속기간은 충족, 소정근로시간만 미충족.
    // (v2 갱신) 숫자(14.9시간)를 직접 입력한 경로이므로 reason은 "belowThreshold"다.
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: false,
      insufficientWeeklyHours: true,
      weeklyHoursIneligibleReason: "belowThreshold",
    });
  });

  // (2026-09-02 Optimizer 수정 — Critic M1 대응 신규 테스트) 두 요건이 동시에 미충족인 경우
  // insufficientServicePeriod/insufficientWeeklyHours가 모두 true여야 한다(UI가 두 사유 모두
  // 안내할 수 있어야 하므로 "둘 중 하나만"이 아니라 "둘 다"를 정확히 표현하는지 확인).
  it("근속기간·소정근로시간이 둘 다 미충족이면 두 사유 플래그가 모두 true다", () => {
    const result = calculateSeverancePay({
      hireDate: "2024-01-01",
      retireDate: "2024-06-30", // 181일 — 365일 미만
      weeklyScheduledHours: 10, // 15시간 미만
      wage3m: 3_000_000,
    });
    // (v2 갱신) 숫자(10시간)를 직접 입력한 경로이므로 reason은 "belowThreshold"다.
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: true,
      insufficientWeeklyHours: true,
      weeklyHoursIneligibleReason: "belowThreshold",
    });
  });

  // 통상임금이 평균임금보다 작으면(또는 같으면) 평균임금이 그대로 기준임금이 되어야 한다.
  it("통상임금이 평균임금보다 작으면 평균임금이 기준임금으로 유지된다", () => {
    const result = calculateSeverancePay({
      hireDate: "2023-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 40,
      wage3m: 9_200_000, // averageDailyWage = 100,000원
      ordinaryDailyWage: 50_000, // 평균임금보다 작음
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.baseDailyWage).toBe(100_000);
  });

  // 윤년이 낀 3개월(2024-03-01 기준 12월+1월+2월, 2024년은 윤년)이면 baseDays=91일.
  it("산정기간에 윤년 2월이 포함되면 baseDays=91일이다", () => {
    const result = calculateSeverancePay({
      hireDate: "2020-01-01",
      retireDate: "2024-03-01",
      weeklyScheduledHours: 40,
      wage3m: 9_100_000,
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    // 2023-12-01 ~ 2024-03-01: 12월(31)+1월(31)+2월(29, 2024 윤년) = 91일.
    expect(result.baseDays).toBe(91);
  });

  // ── 월말 경계(baseDays) clamp 정책 검증 ──────────────────────────────────────────────
  //
  // FORMULA.md "정밀도/반올림 정책 > 산정기간 총일수 월말 처리": 3개월 전 날짜가 대상 월에
  // 존재하지 않으면(예: 5/31→2월엔 31일 없음) 그 달의 마지막 날로 clamp한다. 특정 달만
  // 예외 처리하는 moel.go.kr의 부분 패치(5월만 처리)와 달리, 모든 월말 경계에 동일 규칙을
  // 적용한다. 아래 값들은 명시적 clamp 계산으로 직접 검산했다(diffDays는 하루 단위 순수
  // 달력 계산이므로 별도 근사 없이 정확한 정수가 기대된다).
  //
  // 참고: JS Date의 자동 월 오버플로 정규화(구 구현)에 맡겼다면 5/31→"3/2"(2월 28/29일을
  // 넘어간 날짜)로 밀려 baseDays가 더 짧게(89~91일) 나왔을 것이다 — clamp 정책과 실제로
  // 다른 값을 내므로 이 케이스들은 "정책이 적용됐는지"를 직접 구분하는 회귀 테스트다.
  it("퇴사일이 5월 31일(윤년)이면 3개월 전이 2월 29일로 clamp되어 baseDays=92일이다", () => {
    // clamp: 2024-05-31의 3개월 전 "2월 31일"은 존재하지 않음 → 2024-02-29(윤년)로 clamp.
    expect(calculateBaseDays("2024-05-31")).toBe(92);
  });

  it("퇴사일이 5월 31일(평년)이면 3개월 전이 2월 28일로 clamp되어 baseDays=92일이다", () => {
    // clamp: 2023-05-31의 3개월 전 "2월 31일"은 존재하지 않음 → 2023-02-28(평년)로 clamp.
    expect(calculateBaseDays("2023-05-31")).toBe(92);
  });

  it("퇴사일이 7월 31일이면 3개월 전이 4월 30일로 clamp되어 baseDays=92일이다", () => {
    // clamp: 2024-07-31의 3개월 전 "4월 31일"은 존재하지 않음(4월은 30일까지) → 4월 30일로 clamp.
    // moel.go.kr은 5월만 특수 처리하고 이 케이스(7월)는 처리하지 않는다 — v1은 동일 규칙 적용.
    expect(calculateBaseDays("2024-07-31")).toBe(92);
  });

  it("퇴사일이 12월 31일이면 3개월 전이 9월 30일로 clamp되어 baseDays=92일이다", () => {
    // clamp: 2024-12-31의 3개월 전 "9월 31일"은 존재하지 않음(9월은 30일까지) → 9월 30일로 clamp.
    // moel.go.kr은 이 케이스(12월)도 처리하지 않는다 — v1은 동일 규칙 적용.
    expect(calculateBaseDays("2024-12-31")).toBe(92);
  });

  it("퇴사일이 3월 1일(윤년 2월 경계)이면 3개월 전은 clamp 없이 12월 1일이고 baseDays=91일이다", () => {
    // 2024-03-01의 3개월 전은 2023-12-01(1일은 모든 달에 존재하므로 clamp 대상 아님).
    // 12월(31)+1월(31)+2월(29, 2024 윤년) = 91일 — 윤년 2월 전체가 산정기간에 포함된다.
    expect(calculateBaseDays("2024-03-01")).toBe(91);
  });

  it("퇴사일이 3월 1일(평년)이면 baseDays=90일이다(윤년 2월 경계 대조군)", () => {
    // 2023-03-01의 3개월 전은 2022-12-01. 12월(31)+1월(31)+2월(28, 평년) = 90일.
    // 위 윤년 케이스(91일)와 정확히 1일 차이 — 윤년 여부가 baseDays에 반영됨을 대조 확인.
    expect(calculateBaseDays("2023-03-01")).toBe(90);
  });

  // 매우 큰 입력값에서도 안전 정수 범위 내에서 정확히 계산되는지 확인(오버플로/정밀도 붕괴 없음).
  it("매우 큰 임금총액 입력에서도 안전한 정수 범위 내에서 계산된다", () => {
    const result = calculateSeverancePay({
      hireDate: "1990-01-01",
      retireDate: "2026-09-02",
      weeklyScheduledHours: 40,
      wage3m: 300_000_000, // 3개월간 3억원(고액 연봉 가정)
      bonus12m: 100_000_000,
      annualLeavePay12m: 50_000_000,
      ordinaryDailyWage: 5_000_000,
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(Number.isFinite(result.severancePay)).toBe(true);
    expect(Number.isSafeInteger(result.severancePay)).toBe(true);
  });
});

describe("calculateSeverancePay — 주당 소정근로시간 기본값 정책 (v2, FORMULA.md 판정 로직 우선순위)", () => {
  // 우선순위 1번: underFifteenHoursDeclared === true면 weeklyScheduledHours 입력 여부·값과
  // 무관하게 즉시 미충족이어야 한다. 여기서는 40시간(요건을 충족하고도 남는 값)을 입력해도
  // 자진신고가 우선함을 확인한다.
  it("(a) underFifteenHoursDeclared=true면 weeklyScheduledHours 값과 무관하게 즉시 미충족이다", () => {
    const result = calculateSeverancePay({
      hireDate: "2022-01-01",
      retireDate: "2024-01-01", // 근속 2년 — 근속 요건은 충족
      weeklyScheduledHours: 40, // 숫자로는 요건을 넉넉히 충족
      underFifteenHoursDeclared: true, // 그러나 자진신고가 우선
      wage3m: 6_000_000,
    });
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: false,
      insufficientWeeklyHours: true,
      weeklyHoursIneligibleReason: "declared",
    });
  });

  // 자진신고 시 weeklyScheduledHours 자체를 아예 입력하지 않은 경우도 동일하게 즉시 미충족이어야
  // 한다(우선순위 1번은 숫자 입력 여부 자체와 무관하다).
  it("(a-2) underFifteenHoursDeclared=true이고 weeklyScheduledHours 미입력이어도 즉시 미충족이다", () => {
    const result = calculateSeverancePay({
      hireDate: "2022-01-01",
      retireDate: "2024-01-01",
      underFifteenHoursDeclared: true,
      wage3m: 6_000_000,
    });
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: false,
      insufficientWeeklyHours: true,
      weeklyHoursIneligibleReason: "declared",
    });
  });

  // 우선순위 3번: weeklyScheduledHours와 underFifteenHoursDeclared 둘 다 미입력(기본 상태)이면
  // 판정을 생략하고 충족으로 간주해야 한다 — "정규 근로자로 가정"(FORMULA.md) 정책의 핵심 케이스.
  // 근속 1년 이상이면 eligible:true여야 한다.
  it("(b) weeklyScheduledHours·underFifteenHoursDeclared 둘 다 미입력이면 충족으로 간주한다(근속 1년 이상 → eligible:true)", () => {
    const result = calculateSeverancePay({
      hireDate: "2023-01-01",
      retireDate: "2024-01-01", // 근속 정확히 365일
      wage3m: 9_200_000,
    });
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    // 판정 생략 경로도 금액 계산 자체(예제 3과 동일 입력)는 정상적으로 수행되어야 한다.
    expect(result.severancePay).toBe(3_000_000);
  });

  // 우선순위 2번: 자진신고가 없고(false/미입력) weeklyScheduledHours에 숫자가 입력된 경우,
  // 종전과 동일하게 그 값으로 15시간 기준 판정한다 — 10시간은 미만이므로 belowThreshold 사유로
  // 미충족이어야 한다.
  it("(c) 자진신고 없이 weeklyScheduledHours=10만 입력하면 숫자 기준(belowThreshold)으로 미충족 판정한다", () => {
    const result = calculateSeverancePay({
      hireDate: "2022-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 10,
      wage3m: 6_000_000,
    });
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: false,
      insufficientWeeklyHours: true,
      weeklyHoursIneligibleReason: "belowThreshold",
    });
  });

  // (d) 기존 예제 4(근속 미충족)·예제 5(소정근로시간 미충족)가 새 필드 구조(weeklyScheduledHours
  // 선택 전환 + weeklyHoursIneligibleReason 추가)에서도 여전히 통과하는지 재확인한다. 예제 4/5
  // 자체는 위 "Golden Test" describe 블록에 이미 있으므로, 여기서는 v2 신규 필드
  // (weeklyHoursIneligibleReason)까지 포함해 사유가 정확한 케이스로 값을 입력해 재확인한다.
  it("(d) 예제 4(근속 1년 미만)는 v2 필드 구조에서도 동일하게 실패하고 사유가 없다(시간 요건은 충족)", () => {
    const result = calculateSeverancePay({
      hireDate: "2024-01-01",
      retireDate: "2024-06-30",
      weeklyScheduledHours: 40,
      wage3m: 3_000_000,
    });
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: true,
      insufficientWeeklyHours: false,
      weeklyHoursIneligibleReason: undefined,
    });
  });

  it("(d) 예제 5(소정근로시간 15시간 미만)는 v2 필드 구조에서도 동일하게 실패하고 사유는 belowThreshold다", () => {
    const result = calculateSeverancePay({
      hireDate: "2022-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 10,
      wage3m: 6_000_000,
    });
    expect(result).toEqual({
      eligible: false,
      insufficientServicePeriod: false,
      insufficientWeeklyHours: true,
      weeklyHoursIneligibleReason: "belowThreshold",
    });
  });
});
