export interface AgeCalculatorInput { birthDate: string; referenceDate: string }
export interface CalendarAge { years: number; months: number; days: number }
export type BirthdayState = "before" | "today" | "passed";
export interface ZodiacInfo {
  lunarYear: number;
  lunarDate: string;
  ganzhiKorean: string;
  ganzhiChinese: string;
  heavenlyStem: string;
  earthlyBranch: string;
  element: "목" | "화" | "토" | "금" | "수";
  colorLabel: string;
  animal: string;
  displayName: string;
}
export interface AgeCalculatorResult {
  birthDate: string; referenceDate: string; fullAge: number; calendarAge: CalendarAge;
  daysSinceBirth: number; koreanCountingAge: number; yearAge: number;
  birthdayState: BirthdayState; nextBirthday: string; daysUntilBirthday: number;
  birthWeekday: number; referenceWeekday: number; zodiac: ZodiacInfo | null;
}
