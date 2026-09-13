import {describe,expect,it} from "vitest";
import {validateAgeInput} from "./validation";
describe("만 나이 입력 검증",()=>{
  it("정상 입력",()=>expect(validateAgeInput({birthDate:"2000-01-01",referenceDate:"2026-09-05"}).success).toBe(true));
  it("누락 입력",()=>expect(validateAgeInput({birthDate:"",referenceDate:""}).success).toBe(false));
  it("존재하지 않는 날짜",()=>expect(validateAgeInput({birthDate:"2025-02-29",referenceDate:"2026-01-01"}).success).toBe(false));
  it("미래 출생일",()=>expect(validateAgeInput({birthDate:"2027-01-01",referenceDate:"2026-01-01"}).success).toBe(false));
  it("지원 범위 이전",()=>expect(validateAgeInput({birthDate:"1899-12-31",referenceDate:"2026-01-01"}).success).toBe(false));
  it("지원 범위 마지막 날",()=>expect(validateAgeInput({birthDate:"2200-12-31",referenceDate:"2200-12-31"}).success).toBe(true));
});
