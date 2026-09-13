import KoreanLunarCalendar from "korean-lunar-calendar";
import { parseIso } from "./date-utils";
import type { ZodiacInfo } from "./types";

const stems = [
  { korean:"갑", chinese:"甲", element:"목", colorLabel:"푸른" }, { korean:"을", chinese:"乙", element:"목", colorLabel:"푸른" },
  { korean:"병", chinese:"丙", element:"화", colorLabel:"붉은" }, { korean:"정", chinese:"丁", element:"화", colorLabel:"붉은" },
  { korean:"무", chinese:"戊", element:"토", colorLabel:"황금" }, { korean:"기", chinese:"己", element:"토", colorLabel:"황금" },
  { korean:"경", chinese:"庚", element:"금", colorLabel:"흰" }, { korean:"신", chinese:"辛", element:"금", colorLabel:"흰" },
  { korean:"임", chinese:"壬", element:"수", colorLabel:"검은" }, { korean:"계", chinese:"癸", element:"수", colorLabel:"검은" },
] as const;
const branches = [
  { korean:"자", chinese:"子", animal:"쥐" }, { korean:"축", chinese:"丑", animal:"소" },
  { korean:"인", chinese:"寅", animal:"호랑이" }, { korean:"묘", chinese:"卯", animal:"토끼" },
  { korean:"진", chinese:"辰", animal:"용" }, { korean:"사", chinese:"巳", animal:"뱀" },
  { korean:"오", chinese:"午", animal:"말" }, { korean:"미", chinese:"未", animal:"양" },
  { korean:"신", chinese:"申", animal:"원숭이" }, { korean:"유", chinese:"酉", animal:"닭" },
  { korean:"술", chinese:"戌", animal:"개" }, { korean:"해", chinese:"亥", animal:"돼지" },
] as const;

export function calculateZodiac(birthDate: string): ZodiacInfo | null {
  if (birthDate < "1900-01-01" || birthDate > "2050-12-31") return null;
  const p=parseIso(birthDate); const calendar=new KoreanLunarCalendar();
  if (!calendar.setSolarDate(p.year,p.month,p.day)) return null;
  const lunar=calendar.getLunarCalendar(); const indexes=calendar.getGapJaIndex();
  const stem=stems[indexes.cheongan.year]; const branch=branches[indexes.ganji.year];
  const korean=calendar.getKoreanGapja().year; const chinese=calendar.getChineseGapja().year;
  return { lunarYear:lunar.year, lunarDate:`${lunar.year}-${String(lunar.month).padStart(2,"0")}-${String(lunar.day).padStart(2,"0")}`,
    ganzhiKorean:korean, ganzhiChinese:chinese, heavenlyStem:stem.korean, earthlyBranch:branch.korean,
    element:stem.element, colorLabel:stem.colorLabel, animal:branch.animal, displayName:`${stem.colorLabel} ${branch.animal}띠` };
}
