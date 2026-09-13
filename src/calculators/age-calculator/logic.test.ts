import {describe,expect,it} from "vitest";
import {calculateAge} from "./logic";

describe("만 나이 계산",()=>{
  it("법제처 생일 당일 예시",()=>expect(calculateAge({birthDate:"1992-06-28",referenceDate:"2023-06-28"}).fullAge).toBe(31));
  it("법제처 생일 전 예시",()=>expect(calculateAge({birthDate:"1978-07-09",referenceDate:"2023-06-28"}).fullAge).toBe(44));
  it("참고 이미지 예시",()=>{const r=calculateAge({birthDate:"2014-09-16",referenceDate:"2026-09-05"});expect(r.fullAge).toBe(11);expect(r.calendarAge).toEqual({years:11,months:11,days:20});expect(r.daysUntilBirthday).toBe(11);expect(r.daysSinceBirth).toBe(4372);});
  it("생일 당일 D-0",()=>{const r=calculateAge({birthDate:"2000-09-05",referenceDate:"2026-09-05"});expect(r).toMatchObject({fullAge:26,birthdayState:"today",daysUntilBirthday:0});});
  it("생일 다음 날 다음 생일",()=>expect(calculateAge({birthDate:"2000-09-05",referenceDate:"2026-09-06"}).nextBirthday).toBe("2027-09-05"));
  it("출생 당일 0",()=>expect(calculateAge({birthDate:"2026-09-05",referenceDate:"2026-09-05"})).toMatchObject({fullAge:0,calendarAge:{years:0,months:0,days:0},daysSinceBirth:0}));
  it("2월 29일생 평년 2월 28일에 한 살",()=>expect(calculateAge({birthDate:"2024-02-29",referenceDate:"2025-02-28"}).fullAge).toBe(1));
  it("2월 29일생 평년 전날은 0세",()=>expect(calculateAge({birthDate:"2024-02-29",referenceDate:"2025-02-27"}).fullAge).toBe(0));
  it("세는나이와 연 나이",()=>expect(calculateAge({birthDate:"2000-01-01",referenceDate:"2026-01-01"})).toMatchObject({fullAge:26,koreanCountingAge:27,yearAge:26}));
  it("월말의 완전한 월을 원래 날짜 기준으로 계산",()=>expect(calculateAge({birthDate:"2026-01-31",referenceDate:"2026-03-30"}).calendarAge).toEqual({years:0,months:1,days:30}));
});
