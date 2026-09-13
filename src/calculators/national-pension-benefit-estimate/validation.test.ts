/**
 * 국민연금 예상수령액 계산기 — 입력 검증 테스트.
 *
 * tasks/national-pension-benefit-estimate/FORMULA.md "검증 예제" 중 #15(조기/연기 한도 초과)를
 * 그대로 옮긴다(ARCHITECTURE.md "12. Golden Test 배치 전략" — 이 케이스는 logic.ts가 아니라
 * validation.ts의 책임이라 이 파일에 배치한다). 그 외 docs/CALCULATOR_RULES.md "Edge Case
 * Test"가 요구하는 항목(0, 음수, 소수, 매우 큰 값, 빈 입력, 숫자가 아닌 문자열, 경계값)도
 * 함께 검증한다.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_TOTAL_CONTRIBUTION_MONTHS,
  MIN_BIRTH_YEAR,
  TYPICAL_FULL_CAREER_MONTHS,
  maxContributionMonthsForBirthYear,
  validateNationalPensionBenefitInput,
  type RawNationalPensionBenefitFormInput,
} from "./validation";

const CURRENT_YEAR = 2026;

function validInput(
  overrides: RawNationalPensionBenefitFormInput = {},
): RawNationalPensionBenefitFormInput {
  return {
    birthYear: "1965",
    totalContributionMonths: "240",
    averageMonthlyIncome: "3,000,000",
    earlyOrDeferredMonths: "0",
    ...overrides,
  };
}

describe("validateNationalPensionBenefitInput — 정상 입력", () => {
  it("정상 입력은 success:true와 정규화된 숫자 데이터를 반환한다", () => {
    const result = validateNationalPensionBenefitInput(
      validInput(),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      birthYear: 1965,
      totalContributionMonths: 240,
      averageMonthlyIncome: 3_000_000,
      earlyOrDeferredMonths: 0,
    });
  });

  it("earlyOrDeferredMonths를 생략하면 기본값 0으로 처리한다", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ earlyOrDeferredMonths: undefined }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.earlyOrDeferredMonths).toBe(0);
  });
});

describe("Golden Test #15 — 조기/연기 한도 초과(61개월) 입력 오류", () => {
  it("earlyOrDeferredMonths = -61이면 입력 오류로 처리하고 계산하지 않는다", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ earlyOrDeferredMonths: "-61" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toContainEqual({
      field: "earlyOrDeferredMonths",
      message: "조기/연기는 최대 5년(60개월)까지만 가능합니다.",
    });
  });

  it("earlyOrDeferredMonths = +61이면 입력 오류로 처리하고 계산하지 않는다", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ earlyOrDeferredMonths: "61" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toContainEqual({
      field: "earlyOrDeferredMonths",
      message: "조기/연기는 최대 5년(60개월)까지만 가능합니다.",
    });
  });

  it("earlyOrDeferredMonths = -60/+60(경계값)은 정상 처리된다", () => {
    expect(
      validateNationalPensionBenefitInput(
        validInput({ earlyOrDeferredMonths: "-60" }),
        CURRENT_YEAR,
      ).success,
    ).toBe(true);
    expect(
      validateNationalPensionBenefitInput(
        validInput({ earlyOrDeferredMonths: "60" }),
        CURRENT_YEAR,
      ).success,
    ).toBe(true);
  });
});

describe("birthYear 검증", () => {
  it("빈 값이면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ birthYear: "" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it("숫자가 아니면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ birthYear: "가나다" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it("소수면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ birthYear: "1965.5" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it(`하한(${MIN_BIRTH_YEAR}) 미만이면 오류`, () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ birthYear: String(MIN_BIRTH_YEAR - 1) }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it(`하한(${MIN_BIRTH_YEAR}) 경계값은 통과한다`, () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ birthYear: String(MIN_BIRTH_YEAR) }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
  });

  it("상한(현재연도-18) 초과면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ birthYear: String(CURRENT_YEAR - 17) }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it("상한(현재연도-18) 경계값은 통과한다", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ birthYear: String(CURRENT_YEAR - 18) }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
  });
});

describe("totalContributionMonths 검증", () => {
  it("음수면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ totalContributionMonths: "-1" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it("0은 정상 처리된다(자격 미충족 판정은 logic.ts 몫)", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ totalContributionMonths: "0" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
  });

  it("소수면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ totalContributionMonths: "120.5" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it(`논리적 상한(${MAX_TOTAL_CONTRIBUTION_MONTHS}개월) 초과면 오류`, () => {
    const result = validateNationalPensionBenefitInput(
      validInput({
        totalContributionMonths: String(MAX_TOTAL_CONTRIBUTION_MONTHS + 1),
      }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it(`논리적 상한(${MAX_TOTAL_CONTRIBUTION_MONTHS}개월) 경계값은 통과한다`, () => {
    // birthYear를 충분히 옛날로 설정해(MIN_BIRTH_YEAR) 아래 "출생연도 기준 논리적 상한"
    // 규칙(maxContributionMonthsForBirthYear)이 이 상수 상한 자체의 경계값 테스트에
    // 끼어들지 않게 분리한다(두 규칙은 서로 독립적으로 검증돼야 한다).
    const result = validateNationalPensionBenefitInput(
      validInput({
        birthYear: String(MIN_BIRTH_YEAR),
        totalContributionMonths: String(MAX_TOTAL_CONTRIBUTION_MONTHS),
      }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
  });

  it("480개월(40년, FORMULA.md 예제 7)은 상한보다 넉넉히 아래라 정상 처리된다", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ totalContributionMonths: "480" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
  });
});

describe("totalContributionMonths — 출생연도 기준 논리적 상한(2026-09-13 Optimizer 추가)", () => {
  // QA.md 실측 재현 케이스 그대로: 출생연도 2008년(만 18세) + 가입기간 600개월(50년).
  it("QA 재현 케이스 — 출생연도 2008년 + 가입기간 600개월은 오류로 처리된다", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ birthYear: "2008", totalContributionMonths: "600" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.errors.some(
        (e) =>
          e.field === "totalContributionMonths" &&
          e.message.includes("출생연도(2008년)"),
      ),
    ).toBe(true);
  });

  it(`출생연도가 아무리 어려도 "전형적 풀타임 커리어"(${TYPICAL_FULL_CAREER_MONTHS}개월/40년)까지는 항상 허용된다(미래 가입 예정 포함 설계 유지)`, () => {
    // 올해 막 만 18세가 된 사용자가 "앞으로 40년을 채우면 얼마를 받을까"를 미리 계산해 보는
    // 시나리오 — SPEC.md "국민연금 총 가입기간(가입 예정 포함)" 설계를 이 새 규칙이 깨면 안 된다.
    const result = validateNationalPensionBenefitInput(
      validInput({
        birthYear: String(CURRENT_YEAR - 18),
        totalContributionMonths: String(TYPICAL_FULL_CAREER_MONTHS),
      }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
  });

  it("전형적 풀타임 커리어 상한 바로 위(+1개월)는 갓 성인이 된 출생연도 기준으로 오류가 된다", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({
        birthYear: String(CURRENT_YEAR - 18),
        totalContributionMonths: String(TYPICAL_FULL_CAREER_MONTHS + 1),
      }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it("나이가 많으면 전형적 풀타임 커리어(480개월)를 넘는 가입기간도 허용된다(예: 1960년생)", () => {
    const birthYear = 1960;
    const maxMonths = maxContributionMonthsForBirthYear(birthYear, CURRENT_YEAR);
    expect(maxMonths).toBeGreaterThan(TYPICAL_FULL_CAREER_MONTHS);

    const atBoundary = validateNationalPensionBenefitInput(
      validInput({
        birthYear: String(birthYear),
        totalContributionMonths: String(maxMonths),
      }),
      CURRENT_YEAR,
    );
    expect(atBoundary.success).toBe(true);

    const overBoundary = validateNationalPensionBenefitInput(
      validInput({
        birthYear: String(birthYear),
        totalContributionMonths: String(maxMonths + 1),
      }),
      CURRENT_YEAR,
    );
    expect(overBoundary.success).toBe(false);
  });

  it("출생연도 자체가 오류일 때는 이 새 규칙으로 totalContributionMonths에 중복 오류를 만들지 않는다", () => {
    // birthYear가 범위를 벗어나 이미 오류인 경우, birthYearIsValid=false이므로 이 규칙은
    // 적용되지 않는다(총 가입기간이 624개월 이하라면 그 자체로는 오류가 아니어야 한다).
    const result = validateNationalPensionBenefitInput(
      validInput({
        birthYear: String(MIN_BIRTH_YEAR - 1),
        totalContributionMonths: "300",
      }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.errors.some((e) => e.field === "totalContributionMonths"),
    ).toBe(false);
    expect(result.errors.some((e) => e.field === "birthYear")).toBe(true);
  });
});

describe("averageMonthlyIncome 검증", () => {
  it("0이면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ averageMonthlyIncome: "0" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it("음수면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ averageMonthlyIncome: "-100000" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it("숫자가 아니면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ averageMonthlyIncome: "abc" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });

  it("기준소득월액 상한(6,590,000원)을 초과해도 검증 오류가 아니다(clamp 대상)", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ averageMonthlyIncome: "50,000,000" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
  });

  it("기준소득월액 하한(410,000원) 미만이어도 검증 오류가 아니다(clamp 대상)", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ averageMonthlyIncome: "100000" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(true);
  });

  it("빈 값이면 오류", () => {
    const result = validateNationalPensionBenefitInput(
      validInput({ averageMonthlyIncome: "" }),
      CURRENT_YEAR,
    );
    expect(result.success).toBe(false);
  });
});
