/**
 * 실업급여(구직급여) 계산기 — 입력 검증 Edge Case Test.
 *
 * (2026-09-02 Optimizer 수정 — UX/UI Critic High "고용보험 가입기간 입력 방식" 대응) 이 파일이
 * 신규로 담당하는 핵심 검증은 "날짜 두 개(입사일 + 퇴사일) 입력 → 자동 일수 계산" 전환이
 * logic.test.ts의 Golden Test 7개가 쓰던 `insuredPeriodDays` 값과 정확히 같은 값을 재현하는지
 * 확인하는 것이다 — 계산 공식(logic.ts 1~11단계)은 이 전환으로 전혀 바뀌지 않았으므로,
 * "같은 일수만 나오면 나머지는 이미 Calculation Auditor가 검증한 그대로"라는 논리다.
 *
 * 아래 각 케이스의 `insuredStartDate`는 `leaveDate`("2026-08-01")에서 Golden Test 예제의
 * `insuredPeriodDays`만큼 달력일수를 거꾸로 뺀 날짜다(Node로 `diffDaysUtc`를 직접 재현해
 * 정확히 그 일수가 나오는 지점을 역산했다 — 아래 각 테스트 주석에 그 계산 근거를 남긴다).
 */

import { describe, expect, it } from "vitest";
import {
  validateUnemploymentBenefitInput,
  getMaxAllowedDate,
  MIN_ALLOWED_DATE,
} from "./validation";
import { calculateUnemploymentBenefit } from "./logic";

const validInput = {
  leaveDate: "2026-08-01",
  ageAtLeave: "52",
  insuredStartDate: "2020-08-02", // 2,190일 전 (예제 3/7과 동일)
  wage3m: "10,304,000",
};

describe("validateUnemploymentBenefitInput", () => {
  it("정상 입력은 성공하고, insuredStartDate/leaveDate로부터 insuredPeriodDays를 자동 계산한다", () => {
    const result = validateUnemploymentBenefitInput(validInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      leaveDate: "2026-08-01",
      ageAtLeave: 52,
      insuredPeriodDays: 2_190,
      isUltraShortTimeWorker: undefined,
      isDisabled: undefined,
      wage3m: 10_304_000,
    });
  });

  it("필수값(insuredStartDate) 미입력이면 실패한다", () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      insuredStartDate: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "insuredStartDate")).toBe(true);
  });

  it("insuredStartDate 형식이 올바르지 않으면 실패한다", () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      insuredStartDate: "2020/08/02",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "insuredStartDate")).toBe(true);
  });

  it("insuredStartDate가 leaveDate보다 늦으면 실패한다", () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      leaveDate: "2020-01-01",
      insuredStartDate: "2020-08-02",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "insuredStartDate")).toBe(true);
  });

  it("insuredStartDate가 leaveDate와 같은 날이면 성공하고 가입기간 0일로 계산된다(그 결과는 자연스럽게 수급자격 요건 미충족으로 이어짐)", () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      leaveDate: "2026-08-01",
      insuredStartDate: "2026-08-01",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.insuredPeriodDays).toBe(0);
  });

  it("insuredStartDate 허용 범위(MIN_ALLOWED_DATE~getMaxAllowedDate) 밖이면 실패한다", () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      insuredStartDate: "1969-12-31",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "insuredStartDate")).toBe(true);
  });

  it("허용 범위 경계값(MIN_ALLOWED_DATE, getMaxAllowedDate)은 leaveDate 순서만 맞으면 통과한다", () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      leaveDate: getMaxAllowedDate(),
      insuredStartDate: MIN_ALLOWED_DATE,
    });
    expect(result.success).toBe(true);
  });

  it("필수값(wage3m) 미입력이면 실패한다", () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      wage3m: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('오류 메시지 조사 처리: "현재 만 나이" 뒤에는 "은(는)"이 아니라 받침 없는 "는"만 붙는다', () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      ageAtLeave: "abc",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const message = result.errors.find((e) => e.field === "ageAtLeave")?.message;
    expect(message).toBe("현재 만 나이는 숫자여야 합니다.");
  });

  it('오류 메시지 조사 처리: 받침 있는 라벨("입사일")에는 "을"이 붙는다', () => {
    const result = validateUnemploymentBenefitInput({
      ...validInput,
      insuredStartDate: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const message = result.errors.find((e) => e.field === "insuredStartDate")?.message;
    expect(message).toBe("입사일을 입력해 주세요.");
  });
});

describe("validateUnemploymentBenefitInput — 날짜 쌍 입력이 Golden Test의 insuredPeriodDays를 그대로 재현하는지", () => {
  // FORMULA.md "입력값" 표는 "입사일~퇴사일" 또는 "총 가입기간 직접 입력" 중 하나를
  // Architect/Builder 재량으로 선택하도록 위임했다. 이 계산기는 후자(직접 입력)에서 전자(날짜
  // 두 개 자동 계산)로 전환했다(UX/UI Critic High 대응) — 아래는 logic.test.ts Golden Test
  // 1·2·3·5·6·7(예제 4는 자격 미충족 경로라 별도로 아래에서 확인)이 쓰던 `insuredPeriodDays`를
  // 이 새 입력 방식으로 우회 계산해도 정확히 같은 일수·같은 최종 결과가 나오는지 검증한다.
  // leaveDate는 모든 예제가 공통으로 "2026-08-01"을 쓴다. insuredStartDate는 그 날짜에서
  // 각 예제의 insuredPeriodDays만큼 달력일수를 뺀 지점이다(Node로 diffDaysUtc를 직접
  // 재현해 정확히 그 일수가 나오는 것을 별도로 확인했다).
  const leaveDate = "2026-08-01";

  it("예제 1(4,380일=10년 이상): 날짜 쌍(2014-08-04~2026-08-01) → insuredPeriodDays=4380, totalExpectedBenefit=18,387,000원", () => {
    const validation = validateUnemploymentBenefitInput({
      leaveDate,
      ageAtLeave: "55",
      insuredStartDate: "2014-08-04",
      isDisabled: false,
      wage3m: "30000000",
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    expect(validation.data.insuredPeriodDays).toBe(4_380);

    const result = calculateUnemploymentBenefit(validation.data);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.prescribedBenefitDays).toBe(270);
    expect(result.totalExpectedBenefit).toBe(18_387_000);
  });

  it("예제 2(1,460일=4년): 날짜 쌍(2022-08-02~2026-08-01) → insuredPeriodDays=1460, totalExpectedBenefit=11,888,640원", () => {
    const validation = validateUnemploymentBenefitInput({
      leaveDate,
      ageAtLeave: "45",
      insuredStartDate: "2022-08-02",
      isDisabled: false,
      wage3m: "9000000",
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    expect(validation.data.insuredPeriodDays).toBe(1_460);

    const result = calculateUnemploymentBenefit(validation.data);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.prescribedBenefitDays).toBe(180);
    expect(result.totalExpectedBenefit).toBe(11_888_640);
  });

  it("예제 3(2,190일=6년): 날짜 쌍(2020-08-02~2026-08-01) → insuredPeriodDays=2190, totalExpectedBenefit=16,128,000원", () => {
    const validation = validateUnemploymentBenefitInput({
      leaveDate,
      ageAtLeave: "52",
      insuredStartDate: "2020-08-02",
      isDisabled: false,
      wage3m: "10304000",
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    expect(validation.data.insuredPeriodDays).toBe(2_190);

    const result = calculateUnemploymentBenefit(validation.data);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.prescribedBenefitDays).toBe(240);
    expect(result.totalExpectedBenefit).toBe(16_128_000);
  });

  it("예제 4(150일, 자격 미충족): 날짜 쌍(2026-03-04~2026-08-01) → insuredPeriodDays=150, eligible=false", () => {
    const validation = validateUnemploymentBenefitInput({
      leaveDate,
      ageAtLeave: "40",
      insuredStartDate: "2026-03-04",
      wage3m: "6000000",
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    expect(validation.data.insuredPeriodDays).toBe(150);

    const result = calculateUnemploymentBenefit(validation.data);
    expect(result).toEqual({ eligible: false, eligibleByInsuredPeriod: false });
  });

  it("예제 5(180일, 경계값): 날짜 쌍(2026-02-02~2026-08-01) → insuredPeriodDays=180, totalExpectedBenefit=7,925,760원", () => {
    const validation = validateUnemploymentBenefitInput({
      leaveDate,
      ageAtLeave: "30",
      insuredStartDate: "2026-02-02",
      isDisabled: false,
      wage3m: "6000000",
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    expect(validation.data.insuredPeriodDays).toBe(180);

    const result = calculateUnemploymentBenefit(validation.data);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.prescribedBenefitDays).toBe(120);
    expect(result.totalExpectedBenefit).toBe(7_925_760);
  });

  it("예제 6(730일=2년, 연령 경계 50세): 날짜 쌍(2024-08-01~2026-08-01) → insuredPeriodDays=730, totalExpectedBenefit=12,096,000원", () => {
    const validation = validateUnemploymentBenefitInput({
      leaveDate,
      ageAtLeave: "50",
      insuredStartDate: "2024-08-01",
      isDisabled: false,
      wage3m: "10304000",
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    expect(validation.data.insuredPeriodDays).toBe(730);

    const result = calculateUnemploymentBenefit(validation.data);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.ageBandForTable).toBe("50세 이상 및 장애인");
    expect(result.prescribedBenefitDays).toBe(180);
    expect(result.totalExpectedBenefit).toBe(12_096_000);
  });

  it("예제 7(2,190일=6년, 완전정밀도 반올림 정책): 날짜 쌍(2020-08-02~2026-08-01) → insuredPeriodDays=2190, totalExpectedBenefit=16,128,144원", () => {
    const validation = validateUnemploymentBenefitInput({
      leaveDate,
      ageAtLeave: "52",
      insuredStartDate: "2020-08-02",
      isDisabled: false,
      wage3m: "10304092",
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    expect(validation.data.insuredPeriodDays).toBe(2_190);

    const result = calculateUnemploymentBenefit(validation.data);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.prescribedBenefitDays).toBe(240);
    expect(result.totalExpectedBenefit).toBe(16_128_144);
  });
});
