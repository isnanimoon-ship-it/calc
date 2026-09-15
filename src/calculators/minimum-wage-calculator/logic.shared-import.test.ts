/**
 * 최저임금·시급↔월급 계산기 — 주휴시간 산식이 `src/lib/labor-standards.ts`의
 * `calculateWeeklyHolidayHours`를 실제로 import해서 쓰는지(로컬 재구현이 아닌지) 검증한다.
 *
 * Builder 작업 지시: "calculateWeeklyHolidayHours를 src/lib/labor-standards.ts에서 실제로
 * import해서 쓰고 있는지(로컬 재구현이 아닌지) 확인할 수 있는 방식으로 테스트를 작성해라."
 *
 * 단순히 두 함수의 계산 결과가 같은지 비교하는 것으로는 "우연히 같은 산식을 로컬에 다시
 * 구현했을 가능성"을 배제하지 못한다. 대신 `src/lib/labor-standards` 모듈 자체를 모킹해
 * 의도적으로 다른 값(999)을 반환하게 만든 뒤, `logic.ts`의 `calculateWeeklyPaidHours`가 그
 * 모킹된 값을 그대로 반영하는지 확인한다 — 실제로 이 모듈을 import해서 호출하고 있어야만
 * 모킹의 영향을 받는다(로컬 재구현이었다면 이 테스트가 실패한다).
 *
 * `vi.mock`은 파일 상단에서 호이스팅되어 이 파일 전체에 적용되므로, 다른 Golden
 * Test(logic.test.ts)와 분리된 별도 파일로 둔다.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/lib/labor-standards", () => ({
  calculateWeeklyHolidayHours: vi.fn(() => 999),
}));

describe("calculateWeeklyPaidHours — src/lib/labor-standards.ts의 calculateWeeklyHolidayHours를 실제로 import해서 호출한다", () => {
  it("모듈을 모킹하면 그 반환값(999)이 weeklyHolidayHours/weeklyPaidHours에 그대로 반영된다", async () => {
    const { calculateWeeklyPaidHours } = await import("./logic");
    const result = calculateWeeklyPaidHours(20, 40, 8);
    expect(result.weeklyHolidayHours).toBe(999);
    expect(result.weeklyPaidHours).toBe(20 + 999); // = weeklyHours + 모킹된 주휴시간
  });

  it("모킹된 laborStandards.calculateWeeklyHolidayHours가 실제로 호출되었는지 확인한다(인자 포함)", async () => {
    const laborStandards = await import("@/src/lib/labor-standards");
    const { calculateWeeklyPaidHours } = await import("./logic");
    calculateWeeklyPaidHours(30, 40, 8);
    expect(laborStandards.calculateWeeklyHolidayHours).toHaveBeenCalledWith(30, 40, 8);
  });
});
