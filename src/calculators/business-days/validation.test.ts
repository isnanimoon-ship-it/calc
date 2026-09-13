import { describe, expect, it } from "vitest";
import { validateBusinessDaysForm } from "./validation";

describe("영업일 입력 검증", () => {
  const range = { mode:"range" as const, startDate:"2026-01-01", endDate:"2026-01-02", baseDate:"", businessDays:"1" };
  it("정상 기간을 허용한다", () => expect(validateBusinessDaysForm(range)).toEqual([]));
  it("역전된 기간을 거부한다", () => expect(validateBusinessDaysForm({ ...range, endDate:"2025-12-31" })).toHaveLength(1));
  it("지원 범위 밖을 거부한다", () => expect(validateBusinessDaysForm({ ...range, startDate:"2024-12-31" })).toHaveLength(1));
  it("필수 날짜를 검사한다", () => expect(validateBusinessDaysForm({ ...range, startDate:"", endDate:"" })).toHaveLength(2));
  it.each(["-1","1.5","abc",""])("잘못된 영업일 수 %s를 거부한다", (businessDays) => expect(validateBusinessDaysForm({ mode:"offset",startDate:"",endDate:"",baseDate:"2026-01-01",businessDays })).toHaveLength(1));
  it("750일까지 허용한다", () => expect(validateBusinessDaysForm({ mode:"offset",startDate:"",endDate:"",baseDate:"2026-01-01",businessDays:"750" })).toEqual([]));
  it("750일 초과를 거부한다", () => expect(validateBusinessDaysForm({ mode:"offset",startDate:"",endDate:"",baseDate:"2026-01-01",businessDays:"751" })).toHaveLength(1));
});
