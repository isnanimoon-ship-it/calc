import {describe,expect,it} from "vitest";import {validateBmiInput} from "./validation";
const valid={birthDate:"2000-01-01",referenceDate:"2026-09-05",sex:"male" as const,heightCm:"175.5",weightKg:"70",waistCm:""};
describe("BMI 입력 검증",()=>{it("유효한 소수를 변환한다",()=>{const r=validateBmiInput(valid);expect(r.success&&r.data.heightCm).toBe(175.5)});it("미래 출생일을 거부한다",()=>{expect(validateBmiInput({...valid,birthDate:"2027-01-01"}).success).toBe(false)});it("신체 측정 범위를 검증한다",()=>{expect(validateBmiInput({...valid,heightCm:"0",weightKg:"999"}).success).toBe(false)});});
