import { describe, expect, it } from "vitest";
import { isValidIsoDate, validateMilitaryDischargeInput } from "./validation";

describe("validateMilitaryDischargeInput", () => {
  const valid = { serviceType: "army", startDate: "2026-09-04", referenceDate: "2026-09-04" };
  it("정상 입력을 허용한다", () => expect(validateMilitaryDischargeInput(valid).success).toBe(true));
  it("필수 입력을 검사한다", () => expect(validateMilitaryDischargeInput({ serviceType: "", startDate: "", referenceDate: "" }).success).toBe(false));
  it("지원하지 않는 유형을 거부한다", () => expect(validateMilitaryDischargeInput({ ...valid, serviceType: "unknown" }).success).toBe(false));
  it("과거 정책 범위를 거부한다", () => expect(validateMilitaryDischargeInput({ ...valid, startDate: "2020-12-31" }).success).toBe(false));
  it.each(["2025-02-29", "2026-13-01", "2026-00-10", "not-date"])("잘못된 날짜 %s를 거부한다", (date) => expect(isValidIsoDate(date)).toBe(false));
  it("윤년 날짜를 허용한다", () => expect(isValidIsoDate("2024-02-29")).toBe(true));
});
