/**
 * 퇴직금 계산기 — 입력 검증 Edge Case Test.
 * FORMULA.md "예외" 절(날짜 순서, 음수, 필수값, 소정근로시간 상한 등)을 반영한다.
 */

import { describe, expect, it } from "vitest";
import {
  validateSeverancePayInput,
  getMaxAllowedDate,
  MIN_ALLOWED_DATE,
} from "./validation";

const validInput = {
  hireDate: "2023-01-01",
  retireDate: "2024-01-01",
  weeklyScheduledHours: "40",
  wage3m: "9200000",
};

describe("validateSeverancePayInput", () => {
  it("정상 입력은 성공하고 숫자로 정규화된다", () => {
    const result = validateSeverancePayInput(validInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      hireDate: "2023-01-01",
      retireDate: "2024-01-01",
      weeklyScheduledHours: 40,
      wage3m: 9_200_000,
      bonus12m: undefined,
      annualLeavePay12m: undefined,
      ordinaryDailyWage: undefined,
    });
  });

  it("필수값(hireDate) 미입력이면 실패한다", () => {
    const result = validateSeverancePayInput({ ...validInput, hireDate: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "hireDate")).toBe(true);
  });

  it("필수값(wage3m) 미입력이면 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      wage3m: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("퇴사일이 입사일보다 빠르면 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      hireDate: "2024-01-01",
      retireDate: "2023-01-01",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "retireDate")).toBe(true);
  });

  it("퇴사일과 입사일이 같으면 실패한다(퇴사일 > 입사일이어야 함)", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      hireDate: "2024-01-01",
      retireDate: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("존재하지 않는 달력 날짜(2024-02-30)는 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      retireDate: "2024-02-30",
    });
    expect(result.success).toBe(false);
  });

  it("wage3m에 음수를 입력하면 실패한다", () => {
    const result = validateSeverancePayInput({ ...validInput, wage3m: "-1" });
    expect(result.success).toBe(false);
  });

  it("wage3m에 소수를 입력하면 실패한다(원 단위 정수 필수)", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      wage3m: "9200000.5",
    });
    expect(result.success).toBe(false);
  });

  it("wage3m에 숫자가 아닌 문자열을 입력하면 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      wage3m: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("weeklyScheduledHours는 소수를 허용한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      weeklyScheduledHours: "14.5",
    });
    expect(result.success).toBe(true);
  });

  it("weeklyScheduledHours가 168시간을 초과하면 실패한다(상한)", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      weeklyScheduledHours: "169",
    });
    expect(result.success).toBe(false);
  });

  it("weeklyScheduledHours가 정확히 168시간이면 통과한다(경계값)", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      weeklyScheduledHours: "168",
    });
    expect(result.success).toBe(true);
  });

  it("weeklyScheduledHours가 0이면 통과한다(지급요건 미충족 여부는 logic.ts가 판정)", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      weeklyScheduledHours: "0",
    });
    expect(result.success).toBe(true);
  });

  // (2026-09-02 Optimizer 수정 — QA v2 재검증 Medium 대응) trim 없이 Number(" ")를 호출하면
  // JS 특이 동작으로 0이 반환돼 "미입력"이 "숫자 0 입력"으로 둔갑했다(오류 메시지 없이
  // "지급대상 아님" 오판정으로 이어짐). trim 후 undefined로 처리되는지 확인한다.
  it("weeklyScheduledHours에 공백 문자열만 입력하면 미입력(undefined)으로 처리된다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      weeklyScheduledHours: "   ",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.weeklyScheduledHours).toBeUndefined();
  });

  it("wage3m 앞뒤 공백은 trim되어 정상적으로 숫자로 정규화된다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      wage3m: "  9200000  ",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.wage3m).toBe(9_200_000);
  });

  it("선택 입력(bonus12m 등)을 생략해도 성공하고 undefined로 처리된다", () => {
    const result = validateSeverancePayInput(validInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.bonus12m).toBeUndefined();
    expect(result.data.annualLeavePay12m).toBeUndefined();
    expect(result.data.ordinaryDailyWage).toBeUndefined();
  });

  it("선택 입력에 음수를 넣으면 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      bonus12m: "-1000",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "bonus12m")).toBe(true);
  });

  it("선택 입력이 0이면 정상 통과한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      bonus12m: "0",
      annualLeavePay12m: "0",
      ordinaryDailyWage: "0",
    });
    expect(result.success).toBe(true);
  });

  // (2026-09-02 Optimizer 수정 — QA Low 이슈 대응) 금액 필드에 상한(100억원)이 없어
  // 비현실적 극단값에서 안전 정수 범위를 벗어날 수 있다는 QA 지적에 따라 상한을 추가했다.
  it("wage3m이 상한(100억원)을 초과하면 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      wage3m: "10000000001",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "wage3m")).toBe(true);
  });

  it("wage3m이 상한(100억원)과 정확히 같으면 통과한다(경계값)", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      wage3m: "10000000000",
    });
    expect(result.success).toBe(true);
  });

  it("선택 입력(bonus12m)이 상한(100억원)을 초과하면 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      bonus12m: "10000000001",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "bonus12m")).toBe(true);
  });

  // (2026-09-02 Optimizer 수정 — Critic Medium M2 대응) ui.tsx가 금액 입력에 실시간 천 단위
  // 콤마를 표시하게 되면서, validation.ts는 콤마가 섞인 문자열도 올바르게 파싱해야 한다.
  it("wage3m에 천 단위 콤마가 포함돼도 올바르게 숫자로 정규화된다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      wage3m: "9,200,000",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.wage3m).toBe(9_200_000);
  });

  // (2026-09-02 Optimizer 수정 — 실사용자 버그 리포트 대응) Chromium 계열 브라우저에서
  // <input type="date"> 연도 서브필드에 키보드로 직접 입력하면 min/max 속성이 없을 때
  // 4자리를 넘어서도 억제되지 않는 알려진 네이티브 동작이 있다(스크린샷 확인:
  // "123411-09-01" 같은 값). ui.tsx의 min/max는 브라우저 UI 힌트일 뿐이므로, 여기
  // validation.ts에서 실제 값을 검증하는지 확인한다.
  it("hireDate에 6자리 연도가 들어오면 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      hireDate: "123411-09-01",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "hireDate")).toBe(true);
  });

  it("retireDate에 5자리 연도가 들어오면 실패한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      retireDate: "12345-09-01",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "retireDate")).toBe(true);
  });

  it("hireDate 연도가 형식(4자리)은 맞지만 허용 하한(1970-01-01)보다 이르면 실패하고 연도 확인 메시지를 반환한다", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      hireDate: "1969-12-31",
      retireDate: "2024-01-01",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.errors.some(
        (e) => e.field === "hireDate" && e.message === "입사일 연도를 확인해주세요.",
      ),
    ).toBe(true);
  });

  it("retireDate 연도가 허용 상한(오늘로부터 1년 후)보다 훗날이면 실패하고 연도 확인 메시지를 반환한다", () => {
    const maxDate = new Date(`${getMaxAllowedDate()}T00:00:00Z`);
    const overMax = new Date(
      Date.UTC(
        maxDate.getUTCFullYear(),
        maxDate.getUTCMonth(),
        maxDate.getUTCDate() + 1,
      ),
    )
      .toISOString()
      .slice(0, 10);
    const result = validateSeverancePayInput({
      ...validInput,
      hireDate: "2023-01-01",
      retireDate: overMax,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.errors.some(
        (e) =>
          e.field === "retireDate" &&
          e.message === "퇴사일 연도를 확인해주세요.",
      ),
    ).toBe(true);
  });

  it("hireDate가 허용 하한(1970-01-01)과 정확히 같으면 연도 검증은 통과한다(경계값)", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      hireDate: MIN_ALLOWED_DATE,
      retireDate: "2024-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("retireDate가 허용 상한(오늘로부터 1년 후)과 정확히 같으면 연도 검증은 통과한다(경계값)", () => {
    const result = validateSeverancePayInput({
      ...validInput,
      hireDate: "2023-01-01",
      retireDate: getMaxAllowedDate(),
    });
    expect(result.success).toBe(true);
  });

  it("여러 필드가 동시에 잘못되면 오류를 모두 모아 반환한다", () => {
    const result = validateSeverancePayInput({
      hireDate: "",
      retireDate: "",
      weeklyScheduledHours: "abc",
      wage3m: "-5",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});
