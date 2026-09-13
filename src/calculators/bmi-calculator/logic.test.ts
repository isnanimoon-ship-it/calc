import {describe,expect,it} from "vitest";
import {calculateBmi,percentileFromLms} from "./logic";
import {BMI_LMS} from "./lms-data";
describe("BMI 계산",()=>{
 it("BMI 원값을 계산하고 성인 경계를 분류한다",()=>{const base={birthDate:"1990-01-01",referenceDate:"2026-09-05",sex:"male" as const,heightCm:180};expect(calculateBmi({...base,weightKg:18.5*1.8*1.8}).category).toBe("정상");expect(calculateBmi({...base,weightKg:23*1.8*1.8}).category).toBe("비만 전단계");expect(calculateBmi({...base,weightKg:25*1.8*1.8}).category).toBe("1단계 비만");});
 it("LMS 중앙값은 약 50백분위다",()=>{expect(percentileFromLms(16.0189,[24,-0.6187,16.0189,0.0779])).toBeCloseTo(50,3);});
 it("24개월부터 소아 기준, 228개월부터 성인 기준이다",()=>{const input={sex:"female" as const,heightCm:90,weightKg:13,referenceDate:"2026-09-05"};expect(calculateBmi({...input,birthDate:"2024-09-05"}).ageGroup).toBe("child");expect(calculateBmi({...input,birthDate:"2007-09-05"}).ageGroup).toBe("adult");});
 it("24개월 미만은 분류하지 않는다",()=>{const result=calculateBmi({birthDate:"2025-09-06",referenceDate:"2026-09-05",sex:"male",heightCm:75,weightKg:10});expect(result.ageGroup).toBe("infant");expect(result.category).toBe("판정하지 않음");});
 it("성별 허리둘레 기준을 적용한다",()=>{const common={birthDate:"1990-01-01",referenceDate:"2026-09-05",heightCm:170,weightKg:60};expect(calculateBmi({...common,sex:"male",waistCm:90}).waistRisk).toBe(true);expect(calculateBmi({...common,sex:"female",waistCm:84.9}).waistRisk).toBe(false);});
 it("남녀 모두 24~227개월 데이터가 빠짐없이 있다",()=>{for(const rows of [BMI_LMS.male,BMI_LMS.female]){expect(rows).toHaveLength(204);expect(rows.map(row=>row[0])).toEqual(Array.from({length:204},(_,i)=>i+24));}});
});
