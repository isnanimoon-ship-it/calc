import { addMonthsFromBase, anniversaryInYear, differenceInDays, parseIso, weekday } from "./date-utils";
import { calculateZodiac } from "./zodiac";
import type { AgeCalculatorInput, AgeCalculatorResult, CalendarAge } from "./types";

function calendarAge(birthDate: string, referenceDate: string, fullAge: number): CalendarAge {
  const anniversary=anniversaryInYear(birthDate,parseIso(birthDate).year+fullAge);
  let months=0;
  while (months < 11 && addMonthsFromBase(anniversary,months+1) <= referenceDate) months += 1;
  const cursor=addMonthsFromBase(anniversary,months);
  return { years:fullAge, months, days:differenceInDays(cursor,referenceDate) };
}

export function calculateAge(input: AgeCalculatorInput): AgeCalculatorResult {
  const birth=parseIso(input.birthDate); const reference=parseIso(input.referenceDate);
  const birthdayThisYear=anniversaryInYear(input.birthDate,reference.year);
  const birthdayState=input.referenceDate===birthdayThisYear ? "today" : input.referenceDate<birthdayThisYear ? "before" : "passed";
  const fullAge=reference.year-birth.year-(birthdayState==="before"?1:0);
  const nextBirthday=birthdayState==="passed" ? anniversaryInYear(input.birthDate,reference.year+1) : birthdayThisYear;
  return { ...input, fullAge, calendarAge:calendarAge(input.birthDate,input.referenceDate,fullAge),
    daysSinceBirth:differenceInDays(input.birthDate,input.referenceDate), koreanCountingAge:reference.year-birth.year+1,
    yearAge:reference.year-birth.year, birthdayState, nextBirthday, daysUntilBirthday:differenceInDays(input.referenceDate,nextBirthday),
    birthWeekday:weekday(input.birthDate), referenceWeekday:weekday(input.referenceDate), zodiac:calculateZodiac(input.birthDate) };
}
