import { describe, expect, it } from "vitest";
import { parseIsoDateUtc } from "@/src/lib/date-calc";
import { completedMonths, completedYears, monthAnniversary, yearAnniversary } from "./date-utils";

function d(iso: string): Date {
  const parsed = parseIsoDateUtc(iso);
  if (!parsed) throw new Error(`invalid date in test: ${iso}`);
  return parsed;
}

describe("monthAnniversary — 원본 날짜 기준 독립 계산(연쇄 계산 금지)", () => {
  it("FORMULA.md 예시: H=2024-01-31이면 k=1은 clamp(2024-02-29), k=2는 '2024-02-29+1개월'이 아니라 2024-03-31이어야 한다", () => {
    const hire = d("2024-01-31");
    expect(monthAnniversary(hire, 0).getTime()).toBe(d("2024-01-31").getTime());
    // 2월은 31일이 없다 → 윤년 2024년의 마지막 날인 29일로 clamp.
    expect(monthAnniversary(hire, 1).getTime()).toBe(d("2024-02-29").getTime());
    // "2024-02-29 + 1개월 = 2024-03-29"라는 연쇄 계산이 아니라, 원본 H(2024-01-31)의
    // 연월에 2를 더한 2024-03-31이어야 한다(3월은 31일까지 있으므로 clamp 불필요).
    expect(monthAnniversary(hire, 2).getTime()).toBe(d("2024-03-31").getTime());
  });

  it("평년 1월 31일 입사자는 k=1에서 2월 28일로 clamp된다", () => {
    const hire = d("2025-01-31");
    expect(monthAnniversary(hire, 1).getTime()).toBe(d("2025-02-28").getTime());
    // 연쇄 계산이었다면 "2025-02-28 + 1개월"로 3월 28일이 나왔겠지만, 원본 기준 독립 계산이므로
    // 1월 31일 + 2개월 = 3월 31일이다.
    expect(monthAnniversary(hire, 2).getTime()).toBe(d("2025-03-31").getTime());
  });

  it("연도 경계를 넘기는 이동도 정확히 계산한다", () => {
    const hire = d("2025-11-30");
    expect(monthAnniversary(hire, 3).getTime()).toBe(d("2026-02-28").getTime());
  });

  it("말일이 아닌 일반적인 날짜는 clamp 없이 그대로 이동한다", () => {
    const hire = d("2025-01-15");
    expect(monthAnniversary(hire, 6).getTime()).toBe(d("2025-07-15").getTime());
    expect(monthAnniversary(hire, 11).getTime()).toBe(d("2025-12-15").getTime());
  });
});

describe("yearAnniversary — 윤년(2/29) clamp, 원본 날짜 기준 독립 계산", () => {
  it("윤년 2/29 입사자는 평년 도래 시 2/28로 clamp되고, 다음 해도 원본 기준으로 재계산한다", () => {
    const hire = d("2024-02-29");
    expect(yearAnniversary(hire, 0).getTime()).toBe(d("2024-02-29").getTime());
    expect(yearAnniversary(hire, 1).getTime()).toBe(d("2025-02-28").getTime());
    // "2025-02-28 + 1년 = 2026-02-28"이 아니라 원본 H(2024-02-29) 기준 2026년 clamp를
    // 다시 계산한 것과 값이 같아야 한다(2026년도 평년이라 결과적으로 같은 날짜이지만,
    // 계산 경로가 매번 원본 기준이어야 한다는 것을 다음 케이스가 증명한다).
    expect(yearAnniversary(hire, 2).getTime()).toBe(d("2026-02-28").getTime());
    // 2028년은 윤년이므로 원본 기준 재계산 시 2/29 그대로 유지된다 — 연쇄 계산(2027-02-28
    // 기준으로 매년 처리)이었다면 이 결과를 낼 수 없다(clamp된 문자열에는 더 이상 "2/29"
    // 정보가 남아있지 않으므로).
    expect(yearAnniversary(hire, 4).getTime()).toBe(d("2028-02-29").getTime());
  });

  it("일반 날짜(2/29가 아님)는 매년 그대로 이동한다", () => {
    const hire = d("2021-08-01");
    expect(yearAnniversary(hire, 5).getTime()).toBe(d("2026-08-01").getTime());
  });
});

describe("completedMonths", () => {
  it("ARCHITECTURE.md '1.6' 반례 A — hireDate=2025-01-31, referenceDate=2025-02-28 → completedMonths=1 (기존 공용 유틸 재사용 시 0이 나오는 것과 다름을 증명하는 회귀 테스트)", () => {
    expect(completedMonths(d("2025-01-31"), d("2025-02-28"))).toBe(1);
  });

  it("입사 당일 조회는 0개월", () => {
    expect(completedMonths(d("2025-01-15"), d("2025-01-15"))).toBe(0);
  });

  it("FORMULA.md 예제 1 — 입사 1개월차(2025-06-01 → 2025-07-01)", () => {
    expect(completedMonths(d("2025-06-01"), d("2025-07-01"))).toBe(1);
  });

  it("FORMULA.md 예제 3 — 11개월차 상한 근처(2025-01-15 → 2025-12-15)", () => {
    expect(completedMonths(d("2025-01-15"), d("2025-12-15"))).toBe(11);
  });

  it("FORMULA.md 예제 4 — 만 1년 하루 전(2025-01-15 → 2026-01-14)에는 아직 11", () => {
    expect(completedMonths(d("2025-01-15"), d("2026-01-14"))).toBe(11);
  });

  it("12개월 이상 경과해도 상한 11에서 멈춘다(호출부가 별도로 min(11)을 적용하지 않아도 함수 자체가 [0,11] 범위만 탐색)", () => {
    expect(completedMonths(d("2025-01-15"), d("2026-06-15"))).toBe(11);
  });
});

describe("completedYears", () => {
  it("ARCHITECTURE.md '1.6' 반례 B — hireDate=2024-02-29(윤년), referenceDate=2025-02-28 → completedYears=1 (평년 anniversary clamp 검증, 기존 공용 유틸 재사용 시 0이 나오는 것과 다름을 증명하는 회귀 테스트)", () => {
    expect(completedYears(d("2024-02-29"), d("2025-02-28"))).toBe(1);
  });

  it("입사 당일 조회는 0년", () => {
    expect(completedYears(d("2025-01-15"), d("2025-01-15"))).toBe(0);
  });

  it("FORMULA.md 예제 5 — 정확히 1년 시점(2025-01-15 → 2026-01-15) → 1년", () => {
    expect(completedYears(d("2025-01-15"), d("2026-01-15"))).toBe(1);
  });

  it("FORMULA.md 예제 6 — 1년+1일(2026-01-16)에도 아직 1년 유지", () => {
    expect(completedYears(d("2025-01-15"), d("2026-01-16"))).toBe(1);
  });

  it("FORMULA.md 예제 7 — 정확히 2년 시점(2027-01-15) → 2년", () => {
    expect(completedYears(d("2025-01-15"), d("2027-01-15"))).toBe(2);
  });

  it("FORMULA.md 예제 10~12 — 21/22/23년 시점", () => {
    expect(completedYears(d("2005-09-01"), d("2026-09-01"))).toBe(21);
    expect(completedYears(d("2004-09-01"), d("2026-09-01"))).toBe(22);
    expect(completedYears(d("2003-09-01"), d("2026-09-01"))).toBe(23);
  });
});
